import { Prisma } from '@prisma/client';
import prisma from '../../../config/prisma.config';
import { CreateStudyMaterialDto } from '../dto/create-study-material.dto';
import { AppError } from '../../../utils/AppError';

export async function createStudyMaterial(
  teacherProfileId: string,
  dto: CreateStudyMaterialDto
) {
  // Verify subject assignment
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherProfileId },
  });

  if (!teacher) {
    throw new AppError('Teacher profile not found.', 404);
  }

  if (teacher.subjectId !== dto.subjectId) {
    throw new AppError('You can only upload materials for your assigned subject.', 403);
  }

  const material = await prisma.studyMaterial.create({
    data: {
      teacherId: teacherProfileId,
      subjectId: dto.subjectId,
      title: dto.title,
      batch: dto.batch,
      fileUrls: dto.fileUrls || [],
      text: dto.text,
      status: 'Published',
    },
    include: {
      subject: { select: { subjectName: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
    },
  });

  try {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        subjectId: dto.subjectId,
        enrollmentStatus: 'ACTIVE',
        ...(dto.batch && { student: { batch: dto.batch } }),
      },
      include: { student: true },
    });

    const studentIds = enrollments.map((e) => e.student.id);
    if (studentIds.length > 0) {
      const teacherName = material.teacher?.user?.fullName || 'Your teacher';
      const { NotificationService } = require('../../mobile/notification/notification.service');
      await NotificationService.sendIfNotAlreadySent(
        studentIds,
        'MATERIAL_UPLOADED',
        material.id,
        'New Study Material Available',
        `${teacherName} uploaded '${material.title}' for ${material.subject?.subjectName}`,
        { type: 'MATERIAL_UPLOADED', materialId: material.id, route: '/(tabs)/more/materials' }
      );
    }
  } catch (err) {
    console.error('Failed to notify students of new study material:', err);
  }

  return material;
}

export async function getStudyMaterials(filters: {
  subjectId?: string;
  teacherId?: string;
  skip?: number;
  take?: number;
}) {
  const where: Prisma.StudyMaterialWhereInput = {
    deletedAt: null,
  };

  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.teacherId) where.teacherId = filters.teacherId;

  const [data, total] = await Promise.all([
    prisma.studyMaterial.findMany({
      where,
      include: {
        subject: { select: { subjectName: true } },
        teacher: {
          include: { user: { select: { fullName: true } } },
        },
      },
      orderBy: { uploadedAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.studyMaterial.count({ where }),
  ]);

  return { data, total };
}

export async function deleteStudyMaterial(id: string, teacherProfileId: string, role: string) {
  const material = await prisma.studyMaterial.findUnique({
    where: { id },
  });

  if (!material) {
    throw new AppError('Study material not found.', 404);
  }

  // Only the uploader or an Admin/Manager can delete
  if (role === 'TEACHER' && material.teacherId !== teacherProfileId) {
    throw new AppError('You do not have permission to delete this material.', 403);
  }

  await prisma.studyMaterial.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function updateStudyMaterial(
  id: string,
  teacherProfileId: string,
  role: string,
  data: { title?: string; text?: string; batch?: string; status?: string; fileUrls?: string[] }
) {
  const material = await prisma.studyMaterial.findUnique({
    where: { id },
  });

  if (!material) {
    throw new AppError('Study material not found.', 404);
  }

  // Only the uploader or an Admin/Manager can edit
  if (role === 'TEACHER' && material.teacherId !== teacherProfileId) {
    throw new AppError('You do not have permission to edit this material.', 403);
  }

  return await prisma.studyMaterial.update({
    where: { id },
    data: {
      title: data.title,
      text: data.text,
      batch: data.batch,
      status: data.status,
      ...(data.fileUrls && data.fileUrls.length > 0 && {
        fileUrls: {
          push: data.fileUrls
        }
      })
    },
  });
}
