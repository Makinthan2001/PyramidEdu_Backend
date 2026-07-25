import { Request, Response, NextFunction } from 'express';
import { SalaryController as SalaryControllerClass } from './salary.controller';
import { SalaryService } from '../service/salary.service';

export class SalaryController {
  static async getDashboardOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.getDashboardOverview();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.getAnalytics();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        role: typeof req.query.role === 'string' ? req.query.role : undefined,
        department: typeof req.query.department === 'string' ? req.query.department : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        paymentMethod: typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod : undefined,
        salaryMonth: typeof req.query.salaryMonth === 'string' ? req.query.salaryMonth : undefined,
        activeOnly: req.query.activeOnly === 'true',
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
      };

      const result = await SalaryService.getEmployees(filters);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async generateMonthlyPayroll(req: Request, res: Response, next: NextFunction) {
    try {
      const { salaryMonth } = req.body;
      const adminUserId = (req as any).user?.id;
      const data = await SalaryService.generateMonthlyPayroll(salaryMonth, adminUserId);
      res.status(200).json({
        success: true,
        message: 'Monthly payroll generated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async processPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const recordId = String(req.params.id);
      const adminUserId = (req as any).user?.id;
      const data = await SalaryService.processPayment(recordId, req.body, adminUserId);
      res.status(200).json({
        success: true,
        message: 'Salary payment processed successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateBasicSalary(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = String(req.params.employeeId);
      const { role, newSalary, effectiveDate, reason } = req.body;
      const adminUserId = (req as any).user?.id;

      const data = await SalaryService.updateBasicSalary(
        employeeId,
        role,
        Number(newSalary),
        effectiveDate,
        reason,
        adminUserId
      );

      res.status(200).json({
        success: true,
        message: 'Employee basic salary updated successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllowances(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.getAllowances();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.createAllowance(req.body);
      res.status(201).json({
        success: true,
        message: 'Allowance created successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAllowance(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await SalaryService.deleteAllowance(id);
      res.status(200).json({
        success: true,
        message: 'Allowance deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDeductions(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.getDeductions();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalaryService.createDeduction(req.body);
      res.status(201).json({
        success: true,
        message: 'Deduction created successfully.',
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteDeduction(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      await SalaryService.deleteDeduction(id);
      res.status(200).json({
        success: true,
        message: 'Deduction deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  static async getPayslipDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const data = await SalaryService.getPayslipDetails(id);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
