import { Request, Response } from 'express';
import { PerformanceService } from '../service/performance.service';
import prisma from '../../../config/prisma.config';

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
    const result = await performanceService.calculatePerformanceForAll(studentIds);
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

    const updated = await prisma.student.update({
      where: { id: studentId },
      data: { freeCardType: freeCardType as any },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
