import { Request, Response, NextFunction } from 'express';
import * as service from '../service/study-materials.service';
import { createStudyMaterialSchema } from '../validators/study-materials.validator';
import fs from 'fs';
import path from 'path';
import prisma from '../../../config/prisma.config';

export async function createStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    // Parse form data using the zod schema
    const dto = createStudyMaterialSchema.parse(req.body);
    
    // Check files
    // Assuming authenticate middleware sets req.user and we can get teacherProfileId
    // Wait, authenticate sets req.user to JwtAccessPayload. 
    // We need to fetch the teacher profile ID if not in JWT.
    // For now, let's assume the client passes teacherId or we get it from auth
    // Let's get it from the database if they are a teacher
    const userId = req.user!.sub;
    
    // Actually, it's better to fetch teacherProfileId if it's not in the token
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
    
    if (req.user!.role === 'TEACHER' && !user?.teacher) {
      throw new Error("Teacher profile not found");
    }

    const teacherProfileId = user?.teacher?.id;
    if (!teacherProfileId) {
      throw new Error("Only teachers can upload study materials");
    }

    // Get exact subject name
    const subject = await prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new Error("Subject not found");

    const subjectFolder = subject.subjectName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const teacherFolder = user.fullName.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const finalDir = path.join(__dirname, '../../../../uploads/study-materials', subjectFolder, teacherFolder);
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }

    const fileUrls: string[] = [];
    const files = req.files as Express.Multer.File[];
    
    if (files && files.length > 0) {
      for (const file of files) {
        const finalPath = path.join(finalDir, file.filename);
        fs.renameSync(file.path, finalPath);
        // Save relative path
        fileUrls.push(`/uploads/study-materials/${subjectFolder}/${teacherFolder}/${file.filename}`);
      }
    }

    const result = await service.createStudyMaterial(teacherProfileId, { ...dto, fileUrls });
    
    res.status(201).json({
      success: true,
      message: 'Study material uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error("Upload Error:", error);
    // Clean up temp files if error occurs
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred during upload"
    });
  }
}

export async function getStudyMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filters = {
      subjectId: req.query.subjectId as string,
      teacherId: req.query.teacherId as string,
      skip,
      take: limit,
    };

    const result = await service.getStudyMaterials(filters);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error("GET Study Materials Error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal Server Error",
      error: String(error)
    });
  }
}

export async function deleteStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.sub;
    const role = req.user!.role;

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
    
    const teacherProfileId = user?.teacher?.id || '';

    await service.deleteStudyMaterial(id, teacherProfileId, role);

    res.status(200).json({
      success: true,
      message: 'Study material deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.sub;
    const role = req.user!.role;
    
    // Fetch teacher profile if teacher
    let teacherProfileId = '';
    if (role === 'TEACHER') {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
      if (!user?.teacher) throw new Error("Teacher profile not found");
      teacherProfileId = user.teacher.id;
    }

    const { title, text, batch, status } = req.body;
    
    // Process files if any are uploaded
    const fileUrls: string[] = [];
    const files = req.files as Express.Multer.File[];
    
    if (files && files.length > 0) {
      // Get material to know the teacher and subject for folder structure
      const material = await prisma.studyMaterial.findUnique({
        where: { id },
        include: { subject: true, teacher: { include: { user: true } } }
      });
      
      if (material) {
        const subjectFolder = material.subject.subjectName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const teacherFolder = (material.teacher.user.fullName || "Teacher").replace(/[^a-zA-Z0-9.\-_]/g, '_');

        const finalDir = path.join(__dirname, '../../../../uploads/study-materials', subjectFolder, teacherFolder);
        if (!fs.existsSync(finalDir)) {
          fs.mkdirSync(finalDir, { recursive: true });
        }

        for (const file of files) {
          const finalPath = path.join(finalDir, file.filename);
          fs.renameSync(file.path, finalPath);
          fileUrls.push(`/uploads/study-materials/${subjectFolder}/${teacherFolder}/${file.filename}`);
        }
      }
    }

    const result = await service.updateStudyMaterial(id, teacherProfileId, role, { title, text, batch, status, fileUrls });

    res.status(200).json({
      success: true,
      message: 'Study material updated successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred during update"
    });
  }
}
