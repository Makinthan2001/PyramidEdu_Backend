import { Prisma } from '@prisma/client';

export interface Teacher {
  id: number;
  userId: number;
  firstName: string;
  lastName: string;
  nicNumber: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  address: string;
  phone: string;
  specialization?: string | null;
  salary?: Prisma.Decimal | number | null | undefined;
  createdAt?: Date;
  updatedAt?: Date;
  // Optional relations included in service queries
  user?: any;
  subjects?: any[];
}
