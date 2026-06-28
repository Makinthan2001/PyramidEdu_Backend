import { Request, Response, NextFunction } from "express";
import { NotificationService } from "./notification.service";
import { prisma } from "../../../config/prisma.config";

export const NotificationController = {
  registerToken: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const fcmToken = req.body.fcmToken;
      const platform = req.body.platform;

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access.",
        });
      }

      // Find student by user ID
      const student = await prisma.student.findUnique({
        where: { userId: user.id },
      });

      if (!student) {
        return res.status(403).json({
          success: false,
          message: "Only students can register device tokens.",
        });
      }

      const deviceToken = await NotificationService.registerFcmToken(student.id, fcmToken, platform);

      return res.status(200).json({
        success: true,
        message: "FCM token registered successfully.",
        data: deviceToken,
      });
    } catch (err) {
      next(err);
    }
  },
};
