import { Request, Response } from 'express';
import { PracticeMcqService } from '../service/practice-mcq.service';

const practiceMcqService = new PracticeMcqService();

export const getTodayStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const status = await practiceMcqService.checkTodayStatus(user.sub);
    res.json({
      success: true,
      data: status,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const result = await practiceMcqService.generateDailyQuiz(user.sub);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message.includes('already completed')) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const submitQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const { quizId, startedAt, answers } = req.body;
    
    if (!quizId || !startedAt || !Array.isArray(answers)) {
      res.status(400).json({ success: false, message: 'Invalid payload. quizId, startedAt, and answers are required.' });
      return;
    }

    const result = await practiceMcqService.submitDailyQuiz(user.sub, {
      quizId,
      startedAt,
      answers,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message.includes('already completed')) {
      res.status(400).json({ success: false, message: error.message });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
