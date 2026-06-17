import { prisma } from "../../../config/prisma.config";
import axios from "axios";

export const NotificationService = {
  /**
   * Registers or refreshes an FCM token (or Expo Push Token) for a student
   */
  registerFcmToken: async (studentId: string, fcmToken: string, platform?: string) => {
    if (!fcmToken) {
      throw new Error("FCM/Expo Token is required");
    }

    // Check if the token is already registered to anyone
    const existingToken = await prisma.studentDeviceToken.findUnique({
      where: { fcmToken },
    });

    if (existingToken) {
      if (existingToken.studentId === studentId) {
        // Already registered to the same student, make sure it is active
        if (!existingToken.isActive) {
          return prisma.studentDeviceToken.update({
            where: { id: existingToken.id },
            data: { isActive: true, platform: platform || existingToken.platform },
          });
        }
        return existingToken;
      } else {
        // Registered to another student, delete or reassign. To prevent duplicate tokens, reassign to current student.
        return prisma.studentDeviceToken.update({
          where: { id: existingToken.id },
          data: { studentId, isActive: true, platform: platform || existingToken.platform },
        });
      }
    }

    // Create a new record
    return prisma.studentDeviceToken.create({
      data: {
        studentId,
        fcmToken,
        platform: platform || "unknown",
        isActive: true,
      },
    });
  },

  /**
   * Sends multicast notifications to multiple students' devices using Expo Push API
   */
  sendMulticastNotification: async (
    studentIds: string[],
    title: string,
    body: string,
    dataPayload?: Record<string, string>
  ) => {
    // 1. Fetch active tokens for these students
    const devices = await prisma.studentDeviceToken.findMany({
      where: {
        studentId: { in: studentIds },
        isActive: true,
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    if (devices.length === 0) {
      console.log("No active device tokens found for students:", studentIds);
      return { successCount: 0, failureCount: 0 };
    }

    // Ensure they are Expo push tokens (usually start with ExponentPushToken)
    const validDevices = devices.filter((d) => d.fcmToken.startsWith("ExponentPushToken"));

    if (validDevices.length === 0) {
      console.log("No valid Expo push tokens found for students:", studentIds);
      return { successCount: 0, failureCount: 0 };
    }

    // 2. Construct messages payload
    const messages = validDevices.map((d) => ({
      to: d.fcmToken,
      sound: "default",
      title,
      body,
      data: dataPayload || {},
    }));

    try {
      // 3. Send request to Expo Push API
      const response = await axios.post("https://exp.host/--/api/v2/push/send", messages, {
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
      });

      const data = response.data;
      console.log("Expo push response status:", response.status);

      let successCount = 0;
      let failureCount = 0;
      const tokensToRemove: string[] = [];

      if (data && Array.isArray(data.data)) {
        data.data.forEach((ticket: any, index: number) => {
          if (ticket.status === "ok") {
            successCount++;
          } else {
            failureCount++;
            console.error(`Expo Notification Delivery Error:`, ticket.message);
            if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
              tokensToRemove.push(validDevices[index].fcmToken);
            }
          }
        });
      }

      // 4. Handle invalid/unregistered token cleanup
      if (tokensToRemove.length > 0) {
        console.log(`Cleaning up ${tokensToRemove.length} inactive or invalid Expo tokens...`);
        await prisma.studentDeviceToken.updateMany({
          where: {
            fcmToken: { in: tokensToRemove },
          },
          data: {
            isActive: false,
          },
        });
      }

      return {
        successCount,
        failureCount,
      };
    } catch (err) {
      console.error("Failed to send Expo push notifications:", err);
      throw err;
    }
  },

  /**
   * Sends a notification only if it hasn't been sent before (Deduplication)
   */
  sendIfNotAlreadySent: async (
    studentIds: string[],
    eventType: string,
    eventId: string,
    title: string,
    body: string,
    dataPayload?: Record<string, string>
  ) => {
    try {
      const results = { successCount: 0, failureCount: 0 };
      const studentsToNotify: string[] = [];

      for (const studentId of studentIds) {
        const alreadySent = await prisma.notificationLog.findUnique({
          where: {
            studentId_eventType_eventId: {
              studentId,
              eventType,
              eventId,
            },
          },
        });

        if (!alreadySent) {
          studentsToNotify.push(studentId);
        } else {
          console.log(`Duplicate notification blocked: ${eventType}/${eventId} for student ${studentId}`);
        }
      }

      if (studentsToNotify.length === 0) {
        return results;
      }

      // Send the notification
      const sendResult = await NotificationService.sendMulticastNotification(studentsToNotify, title, body, dataPayload);

      // Log it
      for (const studentId of studentsToNotify) {
        await prisma.notificationLog.create({
          data: { studentId, eventType, eventId },
        });
      }

      return sendResult;
    } catch (err) {
      console.error('Error in sendIfNotAlreadySent:', err);
      return { successCount: 0, failureCount: 0 };
    }
  },
};
