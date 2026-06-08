import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../utils/AppError';
import { Request } from 'express';

// Define the root uploads directory
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Create storage engine
const storage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    // Determine the role from the request (assumes auth middleware sets req.userRole)
    const role = (req as any).userRole?.toLowerCase() || 'unknown';
    
    // Determine the target directory
    let folder = 'profile/misc';
    if (role === 'admin') folder = 'profile/admin';
    else if (role === 'teacher') folder = 'profile/teacher';
    else if (role === 'manager') folder = 'profile/manager';
    else if (role === 'student') folder = 'profile/student';
    
    const targetDir = path.join(UPLOADS_DIR, folder);

    // Create directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: uuid-timestamp.extension
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueFilename = `${uuidv4()}-${Date.now()}${ext}`;
    cb(null, uniqueFilename);
  }
});

// File filter to allow only specific image types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Invalid file type. Only JPG, JPEG, PNG, and WEBP are allowed.', 400));
  }
};

// Create the multer instance
export const uploadProfileImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB limit
  }
});
