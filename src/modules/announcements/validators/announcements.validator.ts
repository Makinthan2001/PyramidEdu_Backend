import { z } from 'zod';
import { AnnouncementTarget } from '@prisma/client';

export const createAnnouncementBaseSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title cannot exceed 200 characters'),
  content: z.string().trim().min(1, 'Message content is required'),
  target: z.nativeEnum(AnnouncementTarget).default(AnnouncementTarget.ALL),
  publishDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED']).default('DRAFT'),
  attachmentUrl: z.string().url('Invalid attachment URL').optional().or(z.literal('')).nullable(),
  userIds: z.array(z.string().uuid('User ID must be a valid UUID')).optional(),
  batchIds: z.array(z.string().uuid('Batch ID must be a valid UUID')).optional(),
  subjectIds: z.array(z.string().uuid('Subject ID must be a valid UUID')).optional(),
});

export const createAnnouncementSchema = createAnnouncementBaseSchema.refine(data => {
  if (data.publishDate && data.expiryDate) {
    return data.expiryDate > data.publishDate;
  }
  return true;
}, {
  message: 'Expiry date must be after the publish date',
  path: ['expiryDate'],
});

export const updateAnnouncementSchema = createAnnouncementBaseSchema.partial().refine(data => {
  if (data.publishDate && data.expiryDate) {
    return data.expiryDate > data.publishDate;
  }
  return true;
}, {
  message: 'Expiry date must be after the publish date',
  path: ['expiryDate'],
});

export default {
  createAnnouncementSchema,
  updateAnnouncementSchema,
};
