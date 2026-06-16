import { AnnouncementTarget } from '@prisma/client';

export interface CreateAnnouncementDto {
  title: string;
  content: string;
  target?: AnnouncementTarget;
  publishDate?: string;
  expiryDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SCHEDULED';
  attachmentUrl?: string;
  userIds?: string[];
  batchIds?: string[];
  subjectIds?: string[];
}
