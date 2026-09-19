import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { AnnouncementTarget, Role, NotificationType } from '@prisma/client';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';
import { UpdateAnnouncementDto } from '../dto/update-announcement.dto';

export class AnnouncementsService {
  /**
   * Helper to verify if a teacher is allocated to targeted subjects/batches
   */
  private async validateTeacherPermissions(userId: string, subjectIds?: string[], batchIds?: string[]) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        subjectAllocations: {
          where: { status: 'ACTIVE' },
          include: { batches: true },
        },
      },
    });

    if (!teacher) {
      throw new AppError('Teacher profile not found', 404);
    }

    const allowedSubjectIds = new Set<string>();
    const allowedBatchIds = new Set<string>();

    if (teacher.subjectId) {
      allowedSubjectIds.add(teacher.subjectId);
    }

    teacher.subjectAllocations.forEach((sa) => {
      allowedSubjectIds.add(sa.subjectId);
      sa.batches.forEach((b) => {
        allowedBatchIds.add(b.id);
      });
    });

    if (subjectIds) {
      for (const subId of subjectIds) {
        if (!allowedSubjectIds.has(subId)) {
          throw new AppError(`You are not allocated to subject ID: ${subId}`, 403);
        }
      }
    }

    if (batchIds) {
      for (const batchId of batchIds) {
        if (!allowedBatchIds.has(batchId)) {
          throw new AppError(`You are not allocated to batch ID: ${batchId}`, 403);
        }
      }
    }
  }

  /**
   * Helper to get user IDs of students belonging to a teacher
   */
  async getTeacherStudentUserIds(
    teacherUserId: string,
    batchIds?: string[],
    subjectIds?: string[]
  ): Promise<string[]> {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: teacherUserId },
      include: {
        subjectAllocations: {
          where: { status: 'ACTIVE' },
          include: { batches: true },
        },
      },
    });

    if (!teacher) return [];

    const orConditions: any[] = [];

    // 1. Direct assignment via active enrollment.teacherId
    orConditions.push({
      enrollments: {
        some: {
          teacherId: teacher.id,
          enrollmentStatus: 'ACTIVE',
          ...(subjectIds && subjectIds.length > 0 ? { subjectId: { in: subjectIds } } : {}),
        },
      },
    });

    // 2. Allocation relationship (teacher -> subject -> batch -> enrollment/student)
    for (const alloc of teacher.subjectAllocations) {
      if (subjectIds && subjectIds.length > 0 && !subjectIds.includes(alloc.subjectId)) {
        continue;
      }
      const allocBatchIds = alloc.batches.map((b) => b.id);
      const targetBatchIds =
        batchIds && batchIds.length > 0
          ? allocBatchIds.filter((id) => batchIds.includes(id))
          : allocBatchIds;

      if (targetBatchIds.length > 0) {
        orConditions.push({
          batchId: { in: targetBatchIds },
          enrollments: {
            some: {
              subjectId: alloc.subjectId,
              enrollmentStatus: 'ACTIVE',
            },
          },
        });
      }
    }

    // 3. Teacher primary subject
    if (teacher.subjectId && (!subjectIds || subjectIds.length === 0 || subjectIds.includes(teacher.subjectId))) {
      orConditions.push({
        enrollments: {
          some: {
            subjectId: teacher.subjectId,
            enrollmentStatus: 'ACTIVE',
          },
        },
      });
    }

    if (orConditions.length === 0) return [];

    const students = await prisma.student.findMany({
      where: {
        deletedAt: null,
        approvalStatus: 'APPROVED',
        user: { isActive: true },
        ...(batchIds && batchIds.length > 0 ? { batchId: { in: batchIds } } : {}),
        OR: orConditions,
      },
      select: { userId: true },
    });

    return students.map((s) => s.userId);
  }

  /**
   * Create an announcement
   */
  async createAnnouncement(userId: string, role: Role, dto: CreateAnnouncementDto) {
    // 1. Validate permissions based on role
    if (role === Role.TEACHER) {
      if (dto.target && dto.target !== AnnouncementTarget.STUDENT) {
        throw new AppError('Teachers can only target students', 403);
      }
      await this.validateTeacherPermissions(userId, dto.subjectIds, dto.batchIds);
    } else if (role === Role.MANAGER) {
      if (dto.target === AnnouncementTarget.ADMIN) {
        throw new AppError('Managers cannot target Admin', 403);
      }
      if (dto.userIds && dto.userIds.length > 0) {
        // Ensure no targeted user is an admin
        const targetedAdmins = await prisma.user.count({
          where: {
            id: { in: dto.userIds },
            role: Role.ADMIN,
          },
        });
        if (targetedAdmins > 0) {
          throw new AppError('Managers cannot target Admin users', 403);
        }
      }
    }

    const publishDate = dto.publishDate ? new Date(dto.publishDate) : new Date();
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    // Set correct status if scheduled
    let status = dto.status || 'DRAFT';
    if (status === 'PUBLISHED' && publishDate > new Date()) {
      status = 'SCHEDULED';
    }

    // Connect relations
    const connectUsers = dto.userIds?.map(id => ({ id })) || [];
    const connectBatches = dto.batchIds?.map(id => ({ id })) || [];
    const connectSubjects = dto.subjectIds?.map(id => ({ id })) || [];

    // Resolve if user is admin profile
    let adminId: string | null = null;
    if (role === Role.ADMIN) {
      const admin = await prisma.admin.findUnique({ where: { userId } });
      if (admin) adminId = admin.id;
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: dto.title,
        content: dto.content,
        target: role === Role.TEACHER ? AnnouncementTarget.STUDENT : (dto.target || AnnouncementTarget.ALL),
        publishDate,
        expiryDate,
        priority: dto.priority || 'MEDIUM',
        status,
        attachmentUrl: dto.attachmentUrl || null,
        adminId,
        senderId: userId,
        recipients: { connect: connectUsers },
        batches: { connect: connectBatches },
        subjects: { connect: connectSubjects },
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, profileImage: true },
        },
        batches: true,
        subjects: true,
        recipients: true,
      },
    });

    // Auto-create notifications if published immediately
    if (status === 'PUBLISHED') {
      await this.sendNotificationsForAnnouncement(announcement.id);
    }

    return announcement;
  }

  /**
   * Update an announcement
   */
  async updateAnnouncement(id: string, userId: string, role: Role, dto: UpdateAnnouncementDto) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: { batches: true, subjects: true, recipients: true },
    });

    if (!announcement || announcement.deletedAt) {
      throw new AppError('Announcement not found', 404);
    }

    // Permission checks: Admin can update anything. Manager/Teacher can only update own.
    if (role !== Role.ADMIN && announcement.senderId !== userId) {
      throw new AppError('You are not authorized to update this announcement', 403);
    }

    // Role-specific target validation
    if (role === Role.TEACHER) {
      if (dto.target && dto.target !== AnnouncementTarget.STUDENT) {
        throw new AppError('Teachers can only target students', 403);
      }
      await this.validateTeacherPermissions(userId, dto.subjectIds, dto.batchIds);
    } else if (role === Role.MANAGER) {
      if (dto.target === AnnouncementTarget.ADMIN) {
        throw new AppError('Managers cannot target Admin', 403);
      }
    }

    const publishDate = dto.publishDate ? new Date(dto.publishDate) : announcement.publishDate;
    const expiryDate = dto.expiryDate === null ? null : (dto.expiryDate ? new Date(dto.expiryDate) : announcement.expiryDate);

    let status = dto.status || announcement.status;
    if (status === 'PUBLISHED' && publishDate > new Date()) {
      status = 'SCHEDULED';
    }

    // Sync relationships
    const disconnectUsers = announcement.recipients.map(u => ({ id: u.id }));
    const disconnectBatches = announcement.batches.map(b => ({ id: b.id }));
    const disconnectSubjects = announcement.subjects.map(s => ({ id: s.id }));

    const connectUsers = dto.userIds?.map(uid => ({ id: uid })) || [];
    const connectBatches = dto.batchIds?.map(bid => ({ id: bid })) || [];
    const connectSubjects = dto.subjectIds?.map(sid => ({ id: sid })) || [];

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title: dto.title ?? announcement.title,
        content: dto.content ?? announcement.content,
        target: dto.target ?? announcement.target,
        publishDate,
        expiryDate,
        priority: dto.priority ?? announcement.priority,
        status,
        attachmentUrl: dto.attachmentUrl !== undefined ? dto.attachmentUrl : announcement.attachmentUrl,
        recipients: {
          disconnect: disconnectUsers,
          connect: connectUsers,
        },
        batches: {
          disconnect: disconnectBatches,
          connect: connectBatches,
        },
        subjects: {
          disconnect: disconnectSubjects,
          connect: connectSubjects,
        },
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, profileImage: true },
        },
        batches: true,
        subjects: true,
        recipients: true,
      },
    });

    if (status === 'PUBLISHED' && announcement.status !== 'PUBLISHED') {
      await this.sendNotificationsForAnnouncement(updated.id);
    }

    return updated;
  }

  /**
   * Delete / Soft Delete
   */
  async deleteAnnouncement(id: string, userId: string, role: Role) {
    const announcement = await prisma.announcement.findUnique({ where: { id } });
    if (!announcement || announcement.deletedAt) {
      throw new AppError('Announcement not found', 404);
    }

    if (role !== Role.ADMIN && announcement.senderId !== userId) {
      throw new AppError('You are not authorized to delete this announcement', 403);
    }

    return prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  /**
   * Get Announcement Details
   */
  async getAnnouncementById(id: string, userId: string, role: Role) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true, profileImage: true },
        },
        batches: true,
        subjects: true,
        recipients: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    if (!announcement || announcement.deletedAt) {
      throw new AppError('Announcement not found', 404);
    }

    // Role visibility logic
    if (role === Role.STUDENT) {
      // Validate targeted rules
      const student = await prisma.student.findUnique({
        where: { userId },
        include: { enrollments: true },
      });
      if (!student) {
        throw new AppError('Student profile not found', 404);
      }

      const isPublished = announcement.status === 'PUBLISHED' || 
        (announcement.status === 'SCHEDULED' && announcement.publishDate <= new Date());
      const isExpired = announcement.expiryDate && announcement.expiryDate < new Date();

      if (!isPublished || isExpired || !announcement.isActive) {
        throw new AppError('Announcement is not available', 404);
      }

      // Check target match
      let isRecipient = false;
      const studentSubjectIds = student.enrollments
        .filter(e => e.enrollmentStatus === 'ACTIVE')
        .map(e => e.subjectId);

      if (announcement.recipients.some(r => r.id === userId)) {
        isRecipient = true;
      } else if (announcement.sender?.role === Role.TEACHER && announcement.senderId) {
        // Must be one of the teacher's enrolled students
        const teacherStudentUserIds = await this.getTeacherStudentUserIds(
          announcement.senderId,
          announcement.batches.map(b => b.id),
          announcement.subjects.map(s => s.id)
        );
        if (teacherStudentUserIds.includes(userId)) {
          isRecipient = true;
        }
      } else {
        // Admin or Manager announcement
        if (announcement.target === AnnouncementTarget.ALL || announcement.target === AnnouncementTarget.STUDENT) {
          isRecipient = true;
        } else if (announcement.batches.some(b => b.id === student.batchId)) {
          isRecipient = true;
        } else if (announcement.subjects.some(s => studentSubjectIds.includes(s.id))) {
          isRecipient = true;
        }
      }

      if (!isRecipient) {
        throw new AppError('Access denied to this announcement', 403);
      }
    }

    // Calculate dynamic recipient count
    const recipientCount = await this.calculateRecipientCount(announcement);

    return {
      ...announcement,
      recipientCount,
    };
  }

  /**
    * List announcements (General filterable list)
    */
  async getAnnouncements(query: any, currentUserId: string, role: Role) {
    if (role !== Role.ADMIN && role !== Role.MANAGER) {
      throw new AppError('Only Admins and Managers can access system-wide history', 403);
    }

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    // Dynamic search / filter params
    if (query.title) {
      where.title = { contains: query.title, mode: 'insensitive' };
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.target) {
      where.target = query.target;
    }

    const [total, list] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishDate: 'desc' },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, profileImage: true },
          },
          batches: true,
          subjects: true,
        },
      }),
    ]);

    // Format list with dynamic recipient count
    const data = await Promise.all(
      list.map(async (ann) => {
        const count = await this.calculateRecipientCount(ann);
        return { ...ann, recipientCount: count };
      })
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Get announcements created by the logged-in user
   */
  async getMyAnnouncements(query: any, currentUserId: string, role: Role) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (role === Role.ADMIN) {
      // Admins see all announcements in "My Announcements"
    } else if (role === Role.MANAGER || role === Role.TEACHER) {
      where.senderId = currentUserId;
    } else if (role === Role.STUDENT) {
      return {
        total: 0,
        page,
        limit,
        totalPages: 0,
        data: [],
      };
    }

    if (query.title) {
      where.title = { contains: query.title, mode: 'insensitive' };
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [total, list] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishDate: 'desc' },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, profileImage: true },
          },
          batches: true,
          subjects: true,
        },
      }),
    ]);

    const data = await Promise.all(
      list.map(async (ann) => {
        const count = await this.calculateRecipientCount(ann);
        return { ...ann, recipientCount: count };
      })
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Get announcements received by the logged-in user
   */
  async getReceivedAnnouncements(query: any, currentUserId: string, role: Role) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (role === Role.ADMIN) {
      // Admins see all published/scheduled/expired/archived announcements in system
    } else if (role === Role.MANAGER) {
      // Managers see all announcements in the system (excluding their own for Received feed)
      where.senderId = { not: currentUserId };
      where.status = 'PUBLISHED';
      where.publishDate = { lte: new Date() };
    } else if (role === Role.TEACHER) {
      const teacher = await prisma.teacher.findUnique({
        where: { userId: currentUserId },
        include: {
          subjectAllocations: {
            where: { status: 'ACTIVE' },
            include: { batches: true },
          },
        },
      });

      const teacherSubjectIds = new Set<string>();
      const teacherBatchIds = new Set<string>();
      if (teacher) {
        if (teacher.subjectId) teacherSubjectIds.add(teacher.subjectId);
        teacher.subjectAllocations.forEach((sa) => {
          teacherSubjectIds.add(sa.subjectId);
          sa.batches.forEach((b) => teacherBatchIds.add(b.id));
        });
      }

      where.senderId = { not: currentUserId };
      where.status = 'PUBLISHED';
      where.publishDate = { lte: new Date() };
      where.OR = [
        { target: AnnouncementTarget.ALL },
        { target: AnnouncementTarget.TEACHER },
        { recipients: { some: { id: currentUserId } } },
        { subjects: { some: { id: { in: Array.from(teacherSubjectIds) } } } },
        { batches: { some: { id: { in: Array.from(teacherBatchIds) } } } },
      ];
    } else if (role === Role.STUDENT) {
      const student = await prisma.student.findUnique({
        where: { userId: currentUserId },
        include: { enrollments: true },
      });
      if (!student) throw new AppError('Student profile not found', 404);

      const activeSubjectIds = student.enrollments
        .filter((e) => e.enrollmentStatus === 'ACTIVE')
        .map((e) => e.subjectId);

      // 1. Direct enrollments with teacherId
      const directTeacherIds = student.enrollments
        .filter((e) => e.enrollmentStatus === 'ACTIVE' && e.teacherId)
        .map((e) => e.teacherId as string);

      // 2. Teachers allocated to student's batch & active subjects
      const allocations = await prisma.subjectAllocation.findMany({
        where: {
          status: 'ACTIVE',
          subjectId: { in: activeSubjectIds },
          batches: { some: { id: student.batchId || '' } },
        },
        select: { teacherId: true },
      });

      // 3. Teachers with primary subject matching student active subjects
      const primaryTeachers = await prisma.teacher.findMany({
        where: {
          deletedAt: null,
          subjectId: { in: activeSubjectIds },
        },
        select: { id: true },
      });

      const allTeacherIds = Array.from(
        new Set([
          ...directTeacherIds,
          ...allocations.map((a) => a.teacherId),
          ...primaryTeachers.map((t) => t.id),
        ])
      );

      const teachers = await prisma.teacher.findMany({
        where: { id: { in: allTeacherIds }, deletedAt: null },
        select: { userId: true },
      });
      const myTeacherUserIds = teachers.map((t) => t.userId);

      where.status = 'PUBLISHED';
      where.publishDate = { lte: new Date() };
      where.isActive = true;
      where.OR = [
        // 1. Direct recipient of any announcement
        { recipients: { some: { id: currentUserId } } },

        // 2. Announcements from ADMIN or MANAGER (management / institutional)
        {
          sender: { role: { in: [Role.ADMIN, Role.MANAGER] } },
          OR: [
            { target: AnnouncementTarget.ALL },
            { target: AnnouncementTarget.STUDENT },
            { batches: { some: { id: student.batchId || '' } } },
            { subjects: { some: { id: { in: activeSubjectIds } } } },
          ],
        },

        // 3. System announcements (adminId present or senderId null)
        {
          senderId: null,
          OR: [
            { target: AnnouncementTarget.ALL },
            { target: AnnouncementTarget.STUDENT },
            { batches: { some: { id: student.batchId || '' } } },
            { subjects: { some: { id: { in: activeSubjectIds } } } },
          ],
        },

        // 4. Announcements from student's assigned TEACHERS only
        ...(myTeacherUserIds.length > 0
          ? [
              {
                senderId: { in: myTeacherUserIds },
                sender: { role: Role.TEACHER },
                AND: [
                  {
                    OR: [
                      { batches: { none: {} } },
                      { batches: { some: { id: student.batchId || '' } } },
                    ],
                  },
                  {
                    OR: [
                      { subjects: { none: {} } },
                      { subjects: { some: { id: { in: activeSubjectIds } } } },
                    ],
                  },
                ],
              },
            ]
          : []),
      ];
    }

    if (query.title) {
      where.title = { contains: query.title, mode: 'insensitive' };
    }
    if (query.priority) {
      where.priority = query.priority;
    }

    const [total, list] = await Promise.all([
      prisma.announcement.count({ where }),
      prisma.announcement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishDate: 'desc' },
        include: {
          sender: {
            select: { id: true, fullName: true, role: true, profileImage: true },
          },
          batches: true,
          subjects: true,
        },
      }),
    ]);

    const data = await Promise.all(
      list.map(async (ann) => {
        const count = await this.calculateRecipientCount(ann);
        return { ...ann, recipientCount: count };
      })
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  /**
   * Helper to count intended unique recipients of an announcement
   */
  private async calculateRecipientCount(announcement: any): Promise<number> {
    const target = announcement.target;
    const batchIds = announcement.batches?.map((b: any) => b.id) || [];
    const subjectIds = announcement.subjects?.map((s: any) => s.id) || [];
    const recipientIds = announcement.recipients?.map((r: any) => r.id) || [];

    // If sent by a TEACHER, calculate only this teacher's students
    let isTeacherSender = announcement.sender?.role === Role.TEACHER;
    if (!isTeacherSender && announcement.senderId && !announcement.sender) {
      const senderUser = await prisma.user.findUnique({
        where: { id: announcement.senderId },
        select: { role: true },
      });
      isTeacherSender = senderUser?.role === Role.TEACHER;
    }

    if (isTeacherSender && announcement.senderId) {
      const teacherStudentUserIds = await this.getTeacherStudentUserIds(
        announcement.senderId,
        batchIds.length > 0 ? batchIds : undefined,
        subjectIds.length > 0 ? subjectIds : undefined
      );
      const uniqueIds = new Set([...recipientIds, ...teacherStudentUserIds]);
      return uniqueIds.size;
    }

    if (target === AnnouncementTarget.ALL) {
      return prisma.user.count({ where: { isActive: true } });
    }
    if (target === AnnouncementTarget.STUDENT) {
      return prisma.student.count({ where: { approvalStatus: 'APPROVED', user: { isActive: true } } });
    }
    if (target === AnnouncementTarget.TEACHER) {
      return prisma.teacher.count({ where: { user: { isActive: true } } });
    }
    if (target === AnnouncementTarget.MANAGER) {
      return prisma.manager.count({ where: { user: { isActive: true } } });
    }

    // For specific configurations, fetch the unique union of users matching the filters
    const matchedUserIds = new Set<string>(recipientIds);

    // Fetch student IDs in targeted batches
    if (batchIds.length > 0) {
      const batchStudents = await prisma.student.findMany({
        where: { batchId: { in: batchIds }, approvalStatus: 'APPROVED' },
        select: { userId: true },
      });
      batchStudents.forEach((s) => matchedUserIds.add(s.userId));
    }

    // Fetch student IDs in targeted subjects
    if (subjectIds.length > 0) {
      const subjectStudents = await prisma.enrollment.findMany({
        where: { subjectId: { in: subjectIds }, enrollmentStatus: 'ACTIVE' },
        select: { student: { select: { userId: true } } },
      });
      subjectStudents.forEach((e) => {
        if (e.student) matchedUserIds.add(e.student.userId);
      });
    }

    return matchedUserIds.size;
  }

  /**
   * Resolve specific recipient user IDs to dispatch notifications
   */
  private async resolveRecipientUserIds(announcementId: string): Promise<string[]> {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      include: {
        batches: true,
        subjects: true,
        recipients: true,
        sender: { select: { id: true, role: true } },
      },
    });

    if (!announcement) return [];

    const target = announcement.target;
    const batchIds = announcement.batches.map(b => b.id);
    const subjectIds = announcement.subjects.map(s => s.id);
    const userIds = new Set<string>(announcement.recipients.map(r => r.id));

    // CRITICAL: If announcement was sent by a TEACHER, it must ONLY go to that teacher's students!
    if (announcement.sender?.role === Role.TEACHER && announcement.senderId) {
      const teacherStudentUserIds = await this.getTeacherStudentUserIds(
        announcement.senderId,
        batchIds.length > 0 ? batchIds : undefined,
        subjectIds.length > 0 ? subjectIds : undefined
      );
      teacherStudentUserIds.forEach(uid => userIds.add(uid));
      return Array.from(userIds);
    }

    if (target === AnnouncementTarget.ALL) {
      const allUsers = await prisma.user.findMany({ where: { isActive: true }, select: { id: true } });
      return allUsers.map(u => u.id);
    }
    if (target === AnnouncementTarget.STUDENT) {
      const allStudents = await prisma.student.findMany({
        where: { approvalStatus: 'APPROVED', user: { isActive: true } },
        select: { userId: true },
      });
      return allStudents.map(s => s.userId);
    }
    if (target === AnnouncementTarget.TEACHER) {
      const allTeachers = await prisma.teacher.findMany({
        where: { user: { isActive: true } },
        select: { userId: true },
      });
      return allTeachers.map(t => t.userId);
    }
    if (target === AnnouncementTarget.MANAGER) {
      const allManagers = await prisma.manager.findMany({
        where: { user: { isActive: true } },
        select: { userId: true },
      });
      return allManagers.map(m => m.userId);
    }

    // Add students from targeted batches
    if (batchIds.length > 0) {
      const students = await prisma.student.findMany({
        where: { batchId: { in: batchIds }, approvalStatus: 'APPROVED' },
        select: { userId: true },
      });
      students.forEach(s => userIds.add(s.userId));
    }

    // Add students from targeted subjects
    if (subjectIds.length > 0) {
      const enrollments = await prisma.enrollment.findMany({
        where: { subjectId: { in: subjectIds }, enrollmentStatus: 'ACTIVE' },
        select: { student: { select: { userId: true } } },
      });
      enrollments.forEach(e => {
        if (e.student) userIds.add(e.student.userId);
      });
    }

    return Array.from(userIds);
  }

  /**
   * Bulk dispatch Notifications for published announcements
   */
  async sendNotificationsForAnnouncement(announcementId: string) {
    try {
      const announcement = await prisma.announcement.findUnique({
        where: { id: announcementId },
      });
      if (!announcement) return;

      const recipientIds = await this.resolveRecipientUserIds(announcementId);

      // Filter out sender from receiving their own notification
      const targetRecipientIds = recipientIds.filter(id => id !== announcement.senderId);

      if (targetRecipientIds.length === 0) return;

      // Push Notifications for Students
      const studentProfiles = await prisma.student.findMany({
        where: { userId: { in: targetRecipientIds } },
        select: { id: true },
      });
      const studentIdsToNotify = studentProfiles.map(s => s.id);

      if (studentIdsToNotify.length > 0) {
        const { NotificationService } = require('../../mobile/notification/notification.service');
        await NotificationService.sendIfNotAlreadySent(
          studentIdsToNotify,
          'ANNOUNCEMENT',
          announcement.id,
          'New Announcement',
          announcement.title,
          { type: 'ANNOUNCEMENT', announcementId: announcement.id, route: '/(tabs)/more/notifications' }
        );
      }

      const notificationData = targetRecipientIds.map(receiverId => ({
        senderId: announcement.senderId,
        receiverId,
        title: `New Announcement Received`,
        message: `"${announcement.title}"`,
        notificationType: NotificationType.ANNOUNCEMENT,
        type: 'ANNOUNCEMENT',
        referenceType: 'ANNOUNCEMENT',
        referenceId: announcementId,
        isRead: false,
      }));

      // Prisma batch insert
      await prisma.notification.createMany({
        data: notificationData,
        skipDuplicates: true,
      });
    } catch (error) {
      console.error('Failed to dispatch notifications for announcement:', error);
    }
  }

  /**
   * Automatically publish scheduled announcements & disable expired ones
   * Designed to run on a scheduler or cron
   */
  async processScheduledAndExpiredAnnouncements() {
    const now = new Date();

    // 1. Publish scheduled announcements
    const scheduled = await prisma.announcement.findMany({
      where: {
        status: 'SCHEDULED',
        publishDate: { lte: now },
        deletedAt: null,
      },
    });

    for (const ann of scheduled) {
      await prisma.announcement.update({
        where: { id: ann.id },
        data: { status: 'PUBLISHED' },
      });
      await this.sendNotificationsForAnnouncement(ann.id);
    }

    // 2. Disable expired announcements
    await prisma.announcement.updateMany({
      where: {
        status: 'PUBLISHED',
        expiryDate: { lte: now },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  }
}

export const announcementsService = new AnnouncementsService();
