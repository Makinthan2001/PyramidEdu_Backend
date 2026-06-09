import { Router } from 'express';
import { batchesController } from '../controller/batches.controller';

const router = Router();

// Retrieve batches
router.get('/', batchesController.getBatches);

// Create batch
router.post('/', batchesController.createBatch);

// Update batch
router.put('/:id', batchesController.updateBatch);

// Toggle batch active status
router.patch('/:id/toggle-status', batchesController.toggleActive);

// Delete batch
router.delete('/:id', batchesController.deleteBatch);

export default router;
