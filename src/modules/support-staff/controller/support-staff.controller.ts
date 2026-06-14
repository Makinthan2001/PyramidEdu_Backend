import { Request, Response, NextFunction } from 'express';
import SupportStaffService from '../service/support-staff.service';
import { CreateSupportStaffDto, UpdateSupportStaffDto } from '../dto/index';

/**
 * GET /api/v1/support-staff
 * List support staff with pagination and optional search
 */
export async function getSupportStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string | undefined;

    const result = await SupportStaffService.getSupportStaff({ page, limit, search });
    res.status(200).json({ success: true, message: 'Support staff retrieved', data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/support-staff/:id
 * Retrieve a single support staff member by ID
 */
export async function getSupportStaffById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const staff = await SupportStaffService.getSupportStaffById(id);
    res.status(200).json({ success: true, message: 'Support staff retrieved', data: staff });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/support-staff
 * Create a new support staff profile
 */
export async function createSupportStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const dto: CreateSupportStaffDto = req.body;
    const staff = await SupportStaffService.createSupportStaff(dto);
    res.status(201).json({ success: true, message: 'Support staff created', data: staff });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/support-staff/:id
 * Update support staff details
 */
export async function updateSupportStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const dto: UpdateSupportStaffDto = req.body;
    const staff = await SupportStaffService.updateSupportStaff(id, dto);
    res.status(200).json({ success: true, message: 'Support staff updated', data: staff });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/support-staff/:id
 * Soft delete support staff member
 */
export async function deleteSupportStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const staff = await SupportStaffService.deleteSupportStaff(id);
    res.status(200).json({ success: true, message: 'Support staff deleted (soft)', data: staff });
  } catch (error) {
    next(error);
  }
}

export default {
  getSupportStaff,
  getSupportStaffById,
  createSupportStaff,
  updateSupportStaff,
  deleteSupportStaff,
};
