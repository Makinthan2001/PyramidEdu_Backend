import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { announcementsService } from '../service/announcements.service';

export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const announcement = await announcementsService.createAnnouncement(userId, userRole, req.body);
    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const announcement = await announcementsService.updateAnnouncement(id, userId, userRole, req.body);
    res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    await announcementsService.deleteAnnouncement(id, userId, userRole);
    res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnnouncementById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const announcement = await announcementsService.getAnnouncementById(id, userId, userRole);
    res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const result = await announcementsService.getAnnouncements(req.query, userId, userRole);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const result = await announcementsService.getMyAnnouncements(req.query, userId, userRole);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReceivedAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const result = await announcementsService.getReceivedAnnouncements(req.query, userId, userRole);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function publishAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const announcement = await announcementsService.updateAnnouncement(id, userId, userRole, {
      status: 'PUBLISHED',
      publishDate: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: 'Announcement published successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

export async function archiveAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = (req as any).userId as string;
    const userRole = (req as any).userRole as Role;

    const announcement = await announcementsService.updateAnnouncement(id, userId, userRole, {
      status: 'ARCHIVED',
    });

    res.status(200).json({
      success: true,
      message: 'Announcement archived successfully',
      data: announcement,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getAnnouncementById,
  getAnnouncements,
  getMyAnnouncements,
  getReceivedAnnouncements,
  publishAnnouncement,
  archiveAnnouncement,
};
