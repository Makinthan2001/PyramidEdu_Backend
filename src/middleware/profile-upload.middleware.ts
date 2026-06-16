import multer from 'multer';
import { AppError } from '../utils/AppError';
import { Request } from 'express';

// Use memory storage to store files in buffer for Cloudinary uploads
const storage = multer.memoryStorage();

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
