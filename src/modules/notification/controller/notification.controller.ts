import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../service/notification.service';

export async function getUserNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const result = await notificationService.getUserNotifications(userId, req.query);
    
    res.status(200).json({
      success: true,
      data: result.notifications,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReadNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const result = await notificationService.getUserNotifications(userId, { ...req.query, isRead: 'true' });
    
    res.status(200).json({
      success: true,
      data: result.notifications,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const result = await notificationService.getUnreadCount(userId);
    
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const id = req.params.id as string;
    const notification = await notificationService.markAsRead(userId, id);
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    await notificationService.markAllAsRead(userId);
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
}

export async function softDeleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const id = req.params.id as string;
    await notificationService.softDeleteNotification(userId, id);
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getNotificationDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const id = req.params.id as string;
    const notification = await notificationService.getNotificationDetails(userId, id);
    
    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
}
