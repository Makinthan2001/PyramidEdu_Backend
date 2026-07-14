import { Request, Response, NextFunction } from 'express';
import { MarksService } from '../service/marks.service';

export async function getMarks(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user!.sub;
    const role = (req as any).userRole;

    const filters = {
      batchId: req.query.batchId as string,
      subjectId: req.query.subjectId as string,
      streamId: req.query.streamId as string,
      teacherId: req.query.teacherId as string,
      search: req.query.search as string,
      type: req.query.type as string,
    };


    const marks = await MarksService.getUnifiedMarks(userId, role, filters);

    res.status(200).json({
      success: true,
      data: marks,
    });
  } catch (error) {
    next(error);
  }
}
