import { Router } from 'express';
import { validate } from '../../../middleware/validate';
import { authenticate } from '../../../middleware/authenticate';
import * as controller from '../controller/study-materials.controller';
import { createStudyMaterialSchema } from '../validators/study-materials.validator';
import { upload } from '../../../middleware/upload.middleware';

const router = Router();

// Only authenticated users can list materials
router.get('/', authenticate, controller.getStudyMaterials);

// Only teachers can upload materials (in the controller we check if they are a teacher)
// We use multer upload.array('files') to parse multipart/form-data
// Note: Zod validation on req.body for FormData can be tricky. We might need to adjust or parse it.
router.post('/', authenticate, upload.array('files', 10), controller.createStudyMaterial);

// Update material
router.patch('/:id', authenticate, upload.array('files', 10), controller.updateStudyMaterial);

// Delete material
router.delete('/:id', authenticate, controller.deleteStudyMaterial);

export default router;
