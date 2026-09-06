import prisma from '../../../config/prisma.config';
import { sendEmail } from '../../../utils/email.util';
import { notificationService } from '../../notification/service/notification.service';
import { AppError } from '../../../utils/AppError';

export class FeePolicyService {
  /**
   * Calculates the number of unpaid/overdue fee months for a student.
   */
  static async getStudentUnpaidFeeDetails(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        parent: true,
        fees: {
          where: { deletedAt: null },
          orderBy: { monthYear: 'desc' },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    // Count unpaid or overdue fee months
    const unpaidFees = student.fees.filter((fee) => {
      const isUnpaidStatus = fee.status === 'UNPAID' || fee.status === 'OVERDUE';
      const isPartial = fee.status === 'PARTIAL' && Number(fee.total) - Number(fee.paid) > 0;
      return isUnpaidStatus || isPartial;
    });

    const unpaidCount = unpaidFees.length;
    // FREE_CARD holders are exempted from fee access restrictions
    const isFreeCard = (student as any).freeCardType === 'FREE_CARD';
    const isRestricted = !isFreeCard && unpaidCount >= 3;

    const totalOutstanding = isFreeCard
      ? 0
      : unpaidFees.reduce(
          (sum, fee) => sum + (Number(fee.total) - Number(fee.paid)),
          0
        );

    return {
      studentId: student.id,
      studentName: student.user.fullName,
      indexNumber: student.indexNumber,
      unpaidCount,
      isRestricted,
      totalOutstanding,
      parentEmail: student.parent?.email || null,
      parentName: student.parent?.parentName || 'Parent / Guardian',
      unpaidMonths: unpaidFees.map((f) =>
        f.monthYear.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      ),
    };
  }

  /**
   * Enforces 3-month fee policy: notifies managers & sends parent email warning.
   */
  static async enforceThreeMonthPolicy(studentId: string) {
    const details = await this.getStudentUnpaidFeeDetails(studentId);

    if (!details.isRestricted) {
      return { enforced: false, details };
    }

    // 1. Notify Managers
    try {
      const managers = await prisma.manager.findMany({
        select: { userId: true },
      });

      for (const mgr of managers) {
        await notificationService.createNotification({
          receiverId: mgr.userId,
          title: 'Student Fee Policy Restriction Triggered',
          message: `Student ${details.studentName} (${details.indexNumber || 'N/A'}) has ${details.unpaidCount} unpaid fee months (Rs. ${details.totalOutstanding.toLocaleString()}). Access has been automatically restricted according to policy.`,
          type: 'FINANCIAL',
          referenceType: 'STUDENT',
          referenceId: studentId,
        });
      }
    } catch (err) {
      console.error('[FeePolicyService] Failed to notify managers:', err);
    }

    // 2. Dispatch Automated Parent Warning Email
    let emailSent = false;
    if (details.parentEmail) {
      try {
        const monthList = details.unpaidMonths.map((m) => `<li>${m}</li>`).join('');
        const htmlContent = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #ffffff; color: #1a202c;">
            <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #ef4444; padding-bottom: 15px;">
              <h1 style="color: #dc2626; margin: 0; font-size: 24px; font-weight: 800;">PyramidEdu Notice</h1>
              <p style="color: #9ca3af; margin: 5px 0 0 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Urgent: Academic Access Restriction Notice</p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #374151;">Dear <strong>${details.parentName}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #374151;">
              This is an official notice regarding the academic fee account of your child, <strong>${details.studentName}</strong> (Index No: <strong>${details.indexNumber || 'N/A'}</strong>).
            </p>

            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 15px;">
                Policy Violation: ${details.unpaidCount} Unpaid Fee Months Detected
              </p>
              <p style="margin: 5px 0 0 0; color: #7f1d1d; font-size: 14px;">
                According to institute policy, academic portal features (online exams, practice quizzes, and materials) are restricted for students with 3 or more consecutive unpaid monthly fees.
              </p>
            </div>

            <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #4b5563;">Unpaid Fee Summary</h3>
              <ul style="margin: 0 0 15px 0; padding-left: 20px; color: #374151; font-size: 14px;">
                ${monthList}
              </ul>
              <div style="border-top: 1px solid #e5e7eb; padding-top: 10px; display: flex; justify-space-between;">
                <span style="font-weight: 700; color: #111827;">Total Outstanding Amount:</span>
                <span style="font-weight: 800; color: #dc2626; font-size: 16px;">Rs. ${details.totalOutstanding.toLocaleString()}</span>
              </div>
            </div>

            <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
              Please settle the outstanding balance via the mobile app or contact the Institute Management office to restore complete academic portal access immediately.
            </p>

            <p style="font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 15px; margin-top: 25px;">
              This is an automated system email from PyramidEdu Management. Please do not reply directly to this email.
            </p>
          </div>
        `;

        await sendEmail(
          details.parentEmail,
          `URGENT: Fee Payment & Access Restriction Notice - ${details.studentName}`,
          htmlContent
        );
        emailSent = true;
      } catch (emailErr) {
        console.error('[FeePolicyService] Failed to send parent email notice:', emailErr);
      }
    }

    return {
      enforced: true,
      emailSent,
      details,
    };
  }

  /**
   * Scans all students and enforces fee policy for restricted ones.
   */
  static async enforceAllStudentsFeePolicy() {
    const students = await prisma.student.findMany({
      where: {
        user: { status: 'ACTIVE', isActive: true },
      },
      select: { id: true },
    });

    const results = [];
    for (const s of students) {
      const res = await this.enforceThreeMonthPolicy(s.id);
      if (res.enforced) {
        results.push(res);
      }
    }
    return results;
  }
}
