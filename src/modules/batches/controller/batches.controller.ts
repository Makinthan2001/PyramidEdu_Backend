import { Request, Response } from 'express';
import { batchesService } from '../service/batches.service';

export class BatchesController {
  async createBatch(req: Request, res: Response) {
    try {
      const { batchName, isActive } = req.body;
      if (!batchName) {
        return res.status(400).json({ success: false, message: 'Batch name is required' });
      }

      const newBatch = await batchesService.createBatch(batchName, isActive);
      return res.status(201).json({ success: true, data: newBatch });
    } catch (error: any) {
      if (error.message === 'Batch with this name already exists') {
        return res.status(409).json({ success: false, message: error.message });
      }
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  async getBatches(req: Request, res: Response) {
    try {
      const { activeOnly } = req.query;
      const batches = activeOnly === 'true'
        ? await batchesService.getActiveBatches()
        : await batchesService.getBatches();
      return res.status(200).json({ success: true, data: batches });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  async updateBatch(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { batchName, isActive } = req.body;

      const updatedBatch = await batchesService.updateBatch(id, batchName, isActive);
      return res.status(200).json({ success: true, data: updatedBatch });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  async toggleActive(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
      }

      const updatedBatch = await batchesService.toggleBatchActive(id, isActive);
      return res.status(200).json({ success: true, data: updatedBatch });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }

  async deleteBatch(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      await batchesService.deleteBatch(id);
      return res.status(200).json({ success: true, message: 'Batch deleted successfully' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
  }
}

export const batchesController = new BatchesController();
