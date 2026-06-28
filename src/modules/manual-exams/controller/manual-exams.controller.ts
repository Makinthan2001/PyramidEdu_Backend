import { Request, Response, NextFunction } from 'express';
import { ManualExamsService } from '../service/manual-exams.service';

export async function createManualExam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub as string;
    const result = await ManualExamsService.createManualExam(userId, req.body);
    res.status(201).json({ success: true, message: 'Manual exam created', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getAllManualExams(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub as string;
    const search = req.query.search as string | undefined;
    const result = await ManualExamsService.getAllManualExams(userId, search);
    res.status(200).json({ success: true, message: 'Manual exams retrieved', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getManualExamById(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub as string;
    const id = req.params.id as string;
    const result = await ManualExamsService.getManualExamById(userId, id);
    res.status(200).json({ success: true, message: 'Manual exam retrieved', data: result });
  } catch (error) {
    next(error);
  }
}

export async function getStudentsForManualExam(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub as string;
    const id = req.params.id as string;
    const result = await ManualExamsService.getStudentsForManualExam(userId, id);
    res.status(200).json({ success: true, message: 'Students retrieved', data: result });
  } catch (error) {
    next(error);
  }
}

export async function saveMarks(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.sub as string;
    const id = req.params.id as string;
    const result = await ManualExamsService.saveMarks(userId, id, req.body);
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
}
