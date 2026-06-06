import { Prisma } from '@prisma/client';

export interface Teacher {
  id: string;
  userId: string;
  subjectId?: string | null;
  nic?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | null;
  address?: string | null;
  phone?: string | null;
  salary?: Prisma.Decimal | number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  user?: any;
  subjectAllocations?: any[];
}
