import prisma from '../../../config/prisma.config';

export class BatchesService {
  async createBatch(batchName: string, isActive: boolean = true) {
    const existing = await prisma.batch.findUnique({
      where: { batchName },
    });
    if (existing) {
      throw new Error('Batch with this name already exists');
    }
    return prisma.batch.create({
      data: { batchName, isActive },
    });
  }

  async getBatches() {
    return prisma.batch.findMany({
      orderBy: { batchName: 'desc' },
    });
  }

  async getActiveBatches() {
    return prisma.batch.findMany({
      where: { isActive: true },
      orderBy: { batchName: 'desc' },
    });
  }

  async updateBatch(id: string, batchName: string, isActive: boolean) {
    return prisma.batch.update({
      where: { id },
      data: { batchName, isActive },
    });
  }

  async toggleBatchActive(id: string, isActive: boolean) {
    return prisma.batch.update({
      where: { id },
      data: { isActive },
    });
  }

  async deleteBatch(id: string) {
    return prisma.batch.delete({
      where: { id },
    });
  }
}

export const batchesService = new BatchesService();
