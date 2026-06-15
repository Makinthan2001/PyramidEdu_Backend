import { Request, Response, NextFunction } from "express";
import { examsService } from "../../../exams/service/exams.service";
import prisma from "../../../../config/prisma.config";
import { AppError } from "../../../../utils/AppError";
import { uploadToCloudinary } from "../../../../utils/cloudinary.util";

async function getStudentIdFromUserId(userId: string): Promise<string> {
  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) {
    throw new AppError("Student profile not found", 404);
  }
  return student.id;
}

export async function getMyUpcomingExams(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.sub;
    if (!userId) throw new AppError("Unauthorized", 401);

    const studentId = await getStudentIdFromUserId(userId);
    const exams = await examsService.getStudentUpcomingExams(studentId);
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
}

export async function getStudentQuestions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.sub;
    if (!userId) throw new AppError("Unauthorized", 401);

    const studentId = await getStudentIdFromUserId(userId);
    const questions = await examsService.getQuestionsForStudent(
      req.params.id as string,
      studentId
    );
    res.status(200).json({ success: true, data: questions });
  } catch (error) {
    next(error);
  }
}

export async function submitExam(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.sub;
    if (!userId) throw new AppError("Unauthorized", 401);

    const studentId = await getStudentIdFromUserId(userId);
    const submission = await examsService.submitExam(
      req.params.id as string,
      studentId,
      req.body
    );
    res.status(201).json({
      success: true,
      message: "Exam submitted successfully",
      data: submission,
    });
  } catch (error) {
    next(error);
  }
}

import { enqueuePdfIngestion } from '../../../rag/services/pdf-ingestion.service';

export async function uploadFileToCloudinary(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const file = req.file;
    const bucket = req.body.bucket;

    if (!file) {
      throw new AppError("No file uploaded", 400);
    }
    if (!bucket) {
      throw new AppError("Bucket name is required", 400);
    }

    let folder = "";
    let resourceType: "image" | "raw" | "video" | "auto" = "auto";

    if (bucket === "essay-pdfs") {
      if (file.mimetype !== "application/pdf") {
        throw new AppError("Invalid document format. Only PDF is allowed.", 400);
      }
      if (file.size > 20 * 1024 * 1024) {
        throw new AppError("PDF size cannot exceed 20MB.", 400);
      }
      folder = process.env.CLOUDINARY_ESSAY_FOLDER || "pyramidEdu/essay-pdfs";
      resourceType = "auto";
    } else {
      throw new AppError("Invalid bucket specified for mobile upload", 400);
    }

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const uploadResult = await uploadToCloudinary(file.buffer, {
      folder,
      publicId: fileName,
      resourceType,
    });

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: uploadResult.secure_url,
    });

    if (bucket === "essay-pdfs") {
      enqueuePdfIngestion({
        buffer: file.buffer,
        sourceUrl: uploadResult.secure_url,
      });
    }
  } catch (error) {
    next(error);
  }
}
