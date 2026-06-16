import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { NotificationType } from '@prisma/client';

function mapTypeToNotificationType(type: string): NotificationType {
  switch (type) {
    case 'ANNOUNCEMENT':
      return NotificationType.ANNOUNCEMENT;
    case 'PAYMENT':
      return NotificationType.FINANCIAL;
    case 'EXAM':
    case 'ASSIGNMENT':
    case 'STUDENT_ENROLLMENT':
      return NotificationType.ACADEMIC;
    case 'SYSTEM':
    case 'USER_REGISTRATION':
    case 'REPORT_REMINDER':
    case 'GENERAL':
    default:
      return NotificationType.SYSTEM;
  }
}

export class NotificationService {
  /**
   * Get notifications for a specific user
   */
  async getUserNotifications(userId: string, query: any) {
    const page = parseInt(query.page as string) || 1;
    const limit = parseInt(query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const whereCondition: any = {
      receiverId: userId,
      deletedAt: null,
    };

    if (query.isRead !== undefined) {
      whereCondition.isRead = query.isRead === 'true';
    }

    if (query.type) {
      whereCondition.type = query.type;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: whereCondition,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: whereCondition,
      }),
    ]);

    return {
      notifications,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: {
        receiverId: userId,
        isRead: false,
        deletedAt: null,
      },
    });

    return { count };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        receiverId: userId,
        deletedAt: null,
      },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all user's notifications as read
   */
  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        receiverId: userId,
        isRead: false,
        deletedAt: null,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Soft delete a notification
   */
  async softDeleteNotification(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        receiverId: userId,
        deletedAt: null,
      },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get notification details
   */
  async getNotificationDetails(userId: string, notificationId: string) {
    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        receiverId: userId,
        deletedAt: null,
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!notification) {
      throw new AppError('Notification not found', 404);
    }

    return notification;
  }

  /**
   * Core notification creation service method for internal use
   */
  async createNotification(data: {
    senderId?: string | null;
    receiverId: string;
    title: string;
    message: string;
    type: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    const notificationType = mapTypeToNotificationType(data.type);

    return prisma.notification.create({
      data: {
        senderId: data.senderId || null,
        receiverId: data.receiverId,
        title: data.title,
        message: data.message,
        notificationType,
        type: data.type,
        referenceType: data.referenceType || null,
        referenceId: data.referenceId || null,
        isRead: false,
      },
    });
  }

  /**
   * Create notifications for multiple users
   */
  async createNotifications(data: {
    senderId?: string | null;
    receiverIds: string[];
    title: string;
    message: string;
    type: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }) {
    if (data.receiverIds.length === 0) return [];
    
    const notificationType = mapTypeToNotificationType(data.type);
    
    const notificationsData = data.receiverIds.map(receiverId => ({
      senderId: data.senderId || null,
      receiverId,
      title: data.title,
      message: data.message,
      notificationType,
      type: data.type,
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      isRead: false,
    }));

    return prisma.notification.createMany({
      data: notificationsData,
      skipDuplicates: true,
    });
  }
  /**
   * Automatically notify managers at the end of the month about report readiness
   */
  async triggerMonthlyReportNotifications() {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-11
      const referenceId = `REPORT-${year}-${month}`;

      // Check if we already sent this report notification
      const existing = await prisma.notification.findFirst({
        where: {
          type: 'REPORT_REMINDER',
          referenceId,
        },
      });

      if (existing) {
        return; // Already sent for this month
      }

      // Get all managers
      const managers = await prisma.manager.findMany({
        where: { deletedAt: null },
        select: { userId: true },
      });

      if (managers.length === 0) return;

      const managerIds = managers.map(m => m.userId);
      await this.createNotifications({
        senderId: null,
        receiverIds: managerIds,
        title: 'Monthly Academic Report is ready',
        message: 'Please review the generated report.',
        type: 'REPORT_REMINDER',
        referenceType: 'REPORT',
        referenceId,
      });

      console.log(`Dispatched monthly report notifications to ${managers.length} managers.`);
    } catch (error) {
      console.error('Failed to trigger monthly report notifications:', error);
    }
  }
}

export const notificationService = new NotificationService();
