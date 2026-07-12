import { prisma } from '../../../../config/prisma.config';
import { AppError } from '../../../../utils/AppError';

export class MobileFeeService {
  static async getFeeHistory(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        fees: {
          orderBy: { monthYear: 'desc' },
          include: {
            payments: {
              orderBy: { paymentDate: 'desc' },
            },
          },
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    // Determine current month's fee status
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    let currentFeeStatus = 'UNPAID';
    
    if (student.fees.length > 0) {
      const latestFee = student.fees[0];
      const feeDate = new Date(latestFee.monthYear);
      if (feeDate.getMonth() === currentMonth && feeDate.getFullYear() === currentYear) {
        currentFeeStatus = latestFee.status;
      }
    }

    const history: any[] = [];
    student.fees.forEach((fee) => {
      fee.payments.forEach((payment) => {
        history.push({
          id: payment.id,
          date: payment.paymentDate.toLocaleDateString(),
          amount: Number(payment.amount),
          status: payment.paymentStatus,
          note: `Monthly Fee - ${fee.monthYear.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        });
      });
      // Handle manual cash toggle from manager
      if (fee.status === 'PAID' && fee.payments.length === 0) {
        history.push({
          id: 'CASH-' + fee.id.substring(0, 8),
          date: fee.updatedAt.toLocaleDateString(),
          amount: Number(fee.paid),
          status: 'VERIFIED',
          note: `Monthly Fee - ${fee.monthYear.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`,
        });
      }
    });

    return {
      totalFeeAmount: Number(student.totalFeeAmount) || 0,
      paymentStatus: currentFeeStatus,
      history,
    };
  }

  static async processPayment(userId: string, amount: number, method: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
      include: {
        fees: {
          orderBy: { monthYear: 'desc' },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new AppError('Student not found', 404);
    }

    const now = new Date();
    // Use current month or the latest fee's month if it's the current month
    let targetFee = student.fees[0];
    
    // Create new Fee record if it doesn't exist for this month
    if (!targetFee || targetFee.monthYear.getMonth() !== now.getMonth() || targetFee.monthYear.getFullYear() !== now.getFullYear()) {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      targetFee = await prisma.fee.create({
        data: {
          studentId: student.id,
          total: student.totalFeeAmount || 0,
          paid: 0,
          status: 'UNPAID',
          monthYear: firstDay,
        }
      });
    }

    if (targetFee.status === 'PAID') {
      throw new AppError('Fee for the current month is already paid.', 400);
    }

    // Process the payment
    const simulatedInvoice = `INV-${Math.floor(10000 + Math.random() * 90000)}`;

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        feeId: targetFee.id,
        amount,
        paymentMethod: method.toUpperCase(),
        paymentStatus: 'VERIFIED', // Auto-completed in simulation
        invoiceNumber: simulatedInvoice,
        paymentDate: now,
      }
    });

    // Update the fee status
    await prisma.fee.update({
      where: { id: targetFee.id },
      data: {
        paid: { increment: amount },
        status: 'PAID',
      }
    });

    return payment;
  }
}
