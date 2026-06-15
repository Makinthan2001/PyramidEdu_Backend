import { Request, Response, NextFunction } from 'express';
import * as service from '../service/study-materials.service';
import { createStudyMaterialSchema } from '../validators/study-materials.validator';
import fs from 'fs';
import path from 'path';
import prisma from '../../../config/prisma.config';
import { processRAGIngestion, generateRAGAnswer } from '../../../utils/rag.util';
import { uploadToCloudinary } from '../../../utils/cloudinary.util';

export async function createStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    // Parse form data using the zod schema
    const dto = createStudyMaterialSchema.parse(req.body);
    
    // Check files
    // Assuming authenticate middleware sets req.user and we can get teacherProfileId
    // Wait, authenticate sets req.user to JwtAccessPayload. 
    // We need to fetch the teacher profile ID if not in JWT.
    // For now, let's assume the client passes teacherId or we get it from auth
    // Let's get it from the database if they are a teacher
    const userId = req.user!.sub;
    
    // Actually, it's better to fetch teacherProfileId if it's not in the token
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
    
    if (req.user!.role === 'TEACHER' && !user?.teacher) {
      throw new Error("Teacher profile not found");
    }

    const teacherProfileId = user?.teacher?.id;
    if (!teacherProfileId) {
      throw new Error("Only teachers can upload study materials");
    }

    // Get exact subject name
    const subject = await prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new Error("Subject not found");

    const fileUrls: string[] = [];
    const files = req.files as Express.Multer.File[];
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileBuffer = fs.readFileSync(file.path);
        
        // Upload directly to Cloudinary
        const uploadResult = await uploadToCloudinary(fileBuffer, {
          folder: process.env.CLOUDINARY_STUDY_MATERIAL_FOLDER || 'pyramidEdu/study_material',
          resourceType: 'raw',
        });
        
        fileUrls.push(uploadResult.secure_url);
        
        // Delete temporary local file immediately after successful upload
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (unlinkErr) {
          console.error(`Failed to delete temp file ${file.path}:`, unlinkErr);
        }
      }
    }

    const result = await service.createStudyMaterial(teacherProfileId, { ...dto, fileUrls });

    // Trigger RAG ingestion in the background asynchronously
    if (fileUrls.length > 0) {
      processRAGIngestion(result.id, fileUrls).catch((err) => {
        console.error("RAG Ingestion failed to start:", err);
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Study material uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error("Upload Error:", error);
    // Clean up temp files if error occurs
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }
    
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred during upload"
    });
  }
}

export async function getStudyMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filters = {
      subjectId: req.query.subjectId as string,
      teacherId: req.query.teacherId as string,
      skip,
      take: limit,
    };

    const result = await service.getStudyMaterials(filters);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error("GET Study Materials Error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal Server Error",
      error: String(error)
    });
  }
}

export async function deleteStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.sub;
    const role = req.user!.role;

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
    
    const teacherProfileId = user?.teacher?.id || '';

    await service.deleteStudyMaterial(id, teacherProfileId, role);

    res.status(200).json({
      success: true,
      message: 'Study material deleted successfully'
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudyMaterial(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const userId = req.user!.sub;
    const role = req.user!.role;
    
    // Fetch teacher profile if teacher
    let teacherProfileId = '';
    if (role === 'TEACHER') {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { teacher: true } });
      if (!user?.teacher) throw new Error("Teacher profile not found");
      teacherProfileId = user.teacher.id;
    }

    const { title, text, batch, status } = req.body;
    
    // Process files if any are uploaded
    const fileUrls: string[] = [];
    const files = req.files as Express.Multer.File[];
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileBuffer = fs.readFileSync(file.path);
        
        // Upload directly to Cloudinary
        const uploadResult = await uploadToCloudinary(fileBuffer, {
          folder: process.env.CLOUDINARY_STUDY_MATERIAL_FOLDER || 'pyramidEdu/study_material',
          resourceType: 'raw',
        });
        
        fileUrls.push(uploadResult.secure_url);
        
        // Delete temporary local file immediately
        try {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        } catch (unlinkErr) {
          console.error(`Failed to delete temp file ${file.path}:`, unlinkErr);
        }
      }
    }

    const result = await service.updateStudyMaterial(id, teacherProfileId, role, { title, text, batch, status, fileUrls });

    // Trigger RAG ingestion in the background asynchronously
    if (fileUrls.length > 0) {
      processRAGIngestion(result.id, fileUrls).catch((err) => {
        console.error("RAG Ingestion failed to start:", err);
      });
    }

    res.status(200).json({
      success: true,
      message: 'Study material updated successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred during update"
    });
  }
}

export async function chatWithMaterials(req: Request, res: Response, next: NextFunction) {
  try {
    const { question, subjectId, batchId } = req.body;
    
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Question is required' });
    }

    const answer = await generateRAGAnswer(question.trim(), { subjectId, batchId });
    
    res.status(200).json({
      success: true,
      data: { answer }
    });
  } catch (error) {
    console.error("RAG Chat Error:", error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "An error occurred during RAG chat"
    });
  }
}
