import { Request, Response, NextFunction } from 'express';
import { AnalyticsReportsService, AnalyticsFilter } from '../service/analytics-reports.service';

export class AnalyticsReportsController {
  private static parseFilters(req: Request): AnalyticsFilter {
    const { subjectId, streamId, batchId, month, year, startDate, endDate } = req.query;
    return {
      subjectId: subjectId as string,
      streamId: streamId as string,
      batchId: batchId as string,
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    };
  }

  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = AnalyticsReportsController.parseFilters(req);
      const data = await AnalyticsReportsService.getDashboardSummary(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getStudents(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = AnalyticsReportsController.parseFilters(req);
      const data = await AnalyticsReportsService.getStudentAnalytics(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getTeachers(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsReportsService.getTeacherAnalytics();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getSubjects(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsReportsService.getSubjectAnalytics();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = AnalyticsReportsController.parseFilters(req);
      const data = await AnalyticsReportsService.getAttendanceAnalytics(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getExams(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = AnalyticsReportsController.parseFilters(req);
      const data = await AnalyticsReportsService.getExamAnalytics(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPerformance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AnalyticsReportsService.getPerformanceAnalytics();
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = AnalyticsReportsController.parseFilters(req);
      const data = await AnalyticsReportsService.getPaymentAnalytics(filters);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const { type } = req.query; // 'students' | 'payments' | 'subjects' | 'teachers'
      let csvContent = '';
      let filename = 'analytics-export.csv';

      if (type === 'students') {
        filename = 'student-analytics.csv';
        const data = await AnalyticsReportsService.getStudentAnalytics({});
        csvContent = 'Student Name,Index Number,Average Marks\n';
        data.topStudents.forEach((s) => {
          csvContent += `"${s.name}","${s.indexNumber}","${s.avgScore}"\n`;
        });
      } else if (type === 'payments') {
        filename = 'payment-invoices.csv';
        const data = await AnalyticsReportsService.getPaymentAnalytics({});
        csvContent = 'Student Name,Index Number,Amount Due,Due Date,Status\n';
        data.outstandingInvoices.forEach((i) => {
          csvContent += `"${i.studentName}","${i.indexNumber}","${i.amountDue}","${i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—'}","${i.status}"\n`;
        });
      } else if (type === 'teachers') {
        filename = 'teachers-workload.csv';
        const data = await AnalyticsReportsService.getTeacherAnalytics();
        csvContent = 'Teacher Name,Email,Assigned Subjects,Student Count,Uploaded Materials,Exams Created,Student Avg Score\n';
        data.forEach((t) => {
          csvContent += `"${t.name}","${t.email}","${t.subjects}",${t.studentCount},${t.materialsCount},${t.examsCreated},"${t.avgStudentScore}"\n`;
        });
      } else {
        // default subjects
        filename = 'subjects-performance.csv';
        const data = await AnalyticsReportsService.getSubjectAnalytics();
        csvContent = 'Subject Name,Subject Code,Active Students,Average Score,Max Score,Min Score,Pass Rate\n';
        data.forEach((s) => {
          csvContent += `"${s.name}","${s.code}",${s.students},"${s.avgMarks}","${s.maxMarks}","${s.minMarks}","${s.passRate}%"\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.status(200).send(csvContent);
    } catch (error) {
      next(error);
    }
  }
}
