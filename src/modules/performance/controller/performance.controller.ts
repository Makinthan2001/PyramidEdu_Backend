import { Request, Response } from 'express';
import { PerformanceService } from '../service/performance.service';
import prisma from '../../../config/prisma.config';
import { calculateDiscountedFee } from '../../../utils/fee-calculator.util';

const performanceService = new PerformanceService();

export const calculateForStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id as string;
    // req.user exists because of authenticate middleware
    const user = (req as any).user;
    const result = await performanceService.calculatePerformanceForStudent(studentId, user);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      res.status(403).json({ success: false, message: error.message });
    } else if (error.message.includes('not found')) {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const calculateForAll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentIds } = req.body;
    const user = (req as any).user;
    const result = await performanceService.calculatePerformanceForAll(studentIds, user);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id as string;
    const user = (req as any).user;
    const history = await performanceService.getStudentPerformanceHistory(studentId, user);
    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    if (error.message.includes('Access denied')) {
      res.status(403).json({ success: false, message: error.message });
    } else if (error.message.includes('not found')) {
      res.status(404).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const getStudentsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const students = await performanceService.getPerformanceStudentsList(user);
    res.json({
      success: true,
      data: students,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFreeCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const studentId = req.params.id as string;
    const { freeCardType } = req.body;

    if (!['NONE', 'HALF_CARD', 'FREE_CARD'].includes(freeCardType)) {
      res.status(400).json({ success: false, message: 'Invalid freeCardType' });
      return;
    }

    // 1. Fetch student with active enrollments
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { enrollmentStatus: 'ACTIVE' },
          include: { subject: true },
        },
      },
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    // 2. Compute base fee from active subject enrollments
    let baseFee = student.enrollments.reduce(
      (sum, e) => sum + Number(e.subject?.feeAmount || 0),
      0
    );

    // Fallback if no active enrollments yet
    if (baseFee === 0 && Number(student.totalFeeAmount) > 0) {
      if (student.freeCardType === 'HALF_CARD') {
        baseFee = Number(student.totalFeeAmount) * 2;
      } else {
        baseFee = Number(student.totalFeeAmount);
      }
    }

    // 3. Calculate discounted monthly fee
    const discountedFee = calculateDiscountedFee(baseFee, freeCardType);
    const now = new Date();

    // 4. Update student and sync current month's fee in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedStudent = await tx.student.update({
        where: { id: studentId },
        data: {
          freeCardType: freeCardType as any,
          totalFeeAmount: discountedFee,
          lastFeeUpdateDate: now,
        },
      });

      // Find current month's fee record if it exists
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const currentFee = await tx.fee.findFirst({
        where: {
          studentId,
          monthYear: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
          deletedAt: null,
        },
      });

      if (currentFee) {
        if (freeCardType === 'FREE_CARD') {
          // Free Card: fee waived (total = 0, status = PAID)
          await tx.fee.update({
            where: { id: currentFee.id },
            data: {
              total: 0,
              paid: 0,
              status: 'PAID',
            },
          });
        } else {
          const paidAmount = Number(currentFee.paid || 0);
          let newStatus = currentFee.status;
          if (paidAmount >= discountedFee) {
            newStatus = 'PAID';
          } else if (paidAmount > 0) {
            newStatus = 'PARTIAL';
          } else {
            newStatus = 'UNPAID';
          }

          await tx.fee.update({
            where: { id: currentFee.id },
            data: {
              total: discountedFee,
              status: newStatus,
            },
          });
        }
      }

      return updatedStudent;
    });

    res.json({
      success: true,
      data: updated,
      message: `Free card updated to ${freeCardType}. Total monthly fee recalculated to Rs. ${discountedFee}.`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

