import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';

export interface MarkFilters {
  batchId?: string;
  subjectId?: string;
  streamId?: string;
  teacherId?: string;
  search?: string;
  type?: string;
}


export class MarksService {
  static async getUnifiedMarks(userId: string, role: string, filters: MarkFilters) {
    console.log('MarksService.getUnifiedMarks - userId:', userId, 'role:', role, 'filters:', filters);
    let teacher: any = null;

    // Enforce teacher-specific scoping
    if (role === 'TEACHER') {
      teacher = await prisma.teacher.findFirst({
        where: { userId, deletedAt: null },
        include: {
          subjectAllocations: {
            where: { status: 'ACTIVE' },
            include: {
              batches: true,
            },
          },
        },
      });
      if (!teacher) {
        throw new AppError('Teacher profile not found.', 404);
      }
    }

    const { batchId, subjectId, streamId, teacherId: filterTeacherId, search } = filters;

    let targetTeacher: any = null;
    if (filterTeacherId) {
      targetTeacher = await prisma.teacher.findFirst({
        where: { id: filterTeacherId, deletedAt: null },
        include: {
          subjectAllocations: {
            where: { status: 'ACTIVE' },
            include: {
              batches: true,
            },
          },
        },
      });
    }

    // Load all subjects to map IDs to subject names since Result doesn't have a direct Subject relation in schema.prisma
    const subjects = await prisma.subject.findMany({
      select: { id: true, subjectName: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.id, s.subjectName]));

    // Base query conditions for student relation to apply filters & teacher scoping
    const getStudentFilter = () => {
      const condition: any = {};

      if (streamId) {
        condition.streamId = streamId;
      }

      if (batchId) {
        condition.batchId = batchId;
      }

      const tRecord = role === 'TEACHER' ? teacher : targetTeacher;
      if (tRecord) {
        const orConditions: any[] = [];

        // 1. Direct assignment via active enrollment.teacherId
        orConditions.push({
          enrollments: {
            some: {
              teacherId: tRecord.id,
              enrollmentStatus: 'ACTIVE',
            },
          },
        });

        // 2. Allocation relationship (teacher -> subject -> batch -> student)
        for (const alloc of tRecord.subjectAllocations) {
          const allocBatchIds = alloc.batches.map((b: any) => b.id);
          if (allocBatchIds.length > 0) {
            orConditions.push({
              batchId: { in: allocBatchIds },
              enrollments: {
                some: {
                  subjectId: alloc.subjectId,
                  enrollmentStatus: 'ACTIVE',
                },
              },
            });
          }
        }

        if (orConditions.length > 0) {
          condition.OR = orConditions;
        }
      }

      if (search) {

        condition.user = {
          fullName: {
            contains: search,
            mode: 'insensitive',
          },
        };
      }

      return condition;
    };

    const studentFilter = getStudentFilter();

    // 1. Fetch Manual Exam Marks
    const manualExamMarkWhere: any = {
      student: studentFilter,
    };

    if (subjectId) {
      manualExamMarkWhere.manualExam = { subjectId };
    }
    if (batchId) {
      manualExamMarkWhere.manualExam = {
        ...manualExamMarkWhere.manualExam,
        batchId,
      };
    }
    if (filterTeacherId) {
      manualExamMarkWhere.manualExam = {
        ...manualExamMarkWhere.manualExam,
        teacherId: filterTeacherId,
      };
    }

    const manualExamMarks = await prisma.manualExamMark.findMany({
      where: manualExamMarkWhere,
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            stream: { select: { streamName: true } },
            batchRecord: { select: { batchName: true } },
          },
        },
        manualExam: {
          include: {
            teacher: {
              include: { user: { select: { fullName: true } } },
            },
            batch: { select: { batchName: true } },
          },
        },
      },
    });

    // 2. Fetch Results (Online Exams and Quizzes)
    const resultWhere: any = {
      student: studentFilter,
    };

    if (subjectId) {
      resultWhere.subjectId = subjectId;
    }
    if (filterTeacherId) {
      resultWhere.teacherId = filterTeacherId;
    }

    const results = await prisma.result.findMany({
      where: resultWhere,
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            stream: { select: { streamName: true } },
            batchRecord: { select: { batchName: true } },
          },
        },
        teacher: {
          include: { user: { select: { fullName: true } } },
        },
        exam: {
          include: {
            batchRecord: { select: { batchName: true } },
          },
        },
        quiz: true,
      },
    });

    // 3. Fetch Assignments Submissions
    const assignmentSubmissionWhere: any = {
      student: studentFilter,
      marks: { not: null }, // Only graded ones
    };

    if (subjectId) {
      assignmentSubmissionWhere.assignment = { subjectId };
    }
    if (batchId) {
      assignmentSubmissionWhere.assignment = {
        ...assignmentSubmissionWhere.assignment,
        batchId,
      };
    }

    const assignmentSubmissions = await prisma.assignmentSubmission.findMany({
      where: assignmentSubmissionWhere,
      include: {
        student: {
          include: {
            user: { select: { fullName: true } },
            stream: { select: { streamName: true } },
            batchRecord: { select: { batchName: true } },
          },
        },
        assignment: {
          include: {
            batchRecord: { select: { batchName: true } },
          },
        },
      },
    });

    // Combine and unify
    const unifiedMarks: any[] = [];

    // Map Manual Exam Marks
    manualExamMarks.forEach((m) => {
      // Apply batch filter on manualExam specifically if not covered in studentFilter
      if (batchId && m.manualExam.batchId !== batchId) return;

      unifiedMarks.push({
        id: m.id,
        student: {
          id: m.student.id,
          fullName: m.student.user.fullName,
          indexNumber: m.student.indexNumber,
          batch: m.student.batchRecord?.batchName || m.student.batch || 'N/A',
          stream: m.student.stream?.streamName || 'N/A',
        },
        subject: {
          id: m.manualExam.subjectId,
          name: subjectMap.get(m.manualExam.subjectId) || 'Unknown Subject',
        },
        teacher: {
          id: m.manualExam.teacher.id,
          fullName: m.manualExam.teacher.user.fullName,
        },
        title: m.manualExam.examTitle,
        type: 'MANUAL_EXAM',
        marksObtained: m.marksObtained !== null ? Number(m.marksObtained) : null,
        totalMarks: m.manualExam.totalMarks,
        isAbsent: m.isAbsent,
        examDate: m.manualExam.examDate,
      });
    });

    // Map Results (Online Exams and Quizzes)
    results.forEach((r) => {
      // Determine batch matching
      const examBatchId = r.exam?.batchId;
      if (batchId && examBatchId && examBatchId !== batchId) return;

      const type = r.quizId ? 'QUIZ' : 'ONLINE_EXAM';
      const title = r.exam?.examTitle || r.quiz?.quizTitle || 'Assessment';
      const totalMarks = r.exam?.totalMarks || r.quiz?.totalMarks || 100;

      unifiedMarks.push({
        id: r.id,
        student: {
          id: r.student.id,
          fullName: r.student.user.fullName,
          indexNumber: r.student.indexNumber,
          batch: r.student.batchRecord?.batchName || r.student.batch || 'N/A',
          stream: r.student.stream?.streamName || 'N/A',
        },
        subject: {
          id: r.subjectId,
          name: subjectMap.get(r.subjectId) || 'Unknown Subject',
        },
        teacher: r.teacher
          ? {
              id: r.teacher.id,
              fullName: r.teacher.user.fullName,
            }
          : { id: 'SYSTEM', fullName: 'System Graded' },
        title,
        type,
        marksObtained: r.marks !== null ? Number(r.marks) : null,
        totalMarks,
        isAbsent: false, // Online results are stored only if submitted
        examDate: r.recordedAt,
      });
    });

    // Map Assignments
    assignmentSubmissions.forEach((as) => {
      unifiedMarks.push({
        id: as.id,
        student: {
          id: as.student.id,
          fullName: as.student.user.fullName,
          indexNumber: as.student.indexNumber,
          batch: as.student.batchRecord?.batchName || as.student.batch || 'N/A',
          stream: as.student.stream?.streamName || 'N/A',
        },
        subject: {
          id: as.assignment.subjectId,
          name: subjectMap.get(as.assignment.subjectId) || 'Unknown Subject',
        },
        teacher: { id: 'SYSTEM', fullName: 'Subject Instructor' }, // Assign to instructor or system
        title: as.assignment.title,
        type: 'ASSIGNMENT',
        marksObtained: as.marks !== null ? Number(as.marks) : null,
        totalMarks: as.assignment.totalMarks,
        isAbsent: false,
        examDate: as.submittedAt,
      });
    });

    // Filter by type if specified
    let filteredMarks = unifiedMarks;
    if (filters.type) {
      filteredMarks = unifiedMarks.filter((m) => m.type === filters.type);
    }

    // Sort by examDate descending
    return filteredMarks.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
  }
}

