import { prisma } from '../../../../config/prisma.config';
import { AppError } from '../../../../utils/AppError';
import Stripe from 'stripe';

import { notificationService } from '../../../notification/service/notification.service';
// import { notificationService } from '../../notification/service/notification.service';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15" as any,
});

const frontend_url = process.env.FRONTEND_URL || "http://localhost:8081";
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

  static async processPayment(userId: string, amount: number, method: string, cardDetails?: any) {
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

    // Process the payment via Stripe if card details are provided
    let paymentStatus = 'VERIFIED';
    let transactionId = `INV-${Math.floor(10000 + Math.random() * 90000)}`;

    if (cardDetails && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-01-27.acacia' as any });

        // Extract expiry month and year
        const [expMonth, expYear] = cardDetails.expiry.split('/');

        const paymentMethod = await stripe.paymentMethods.create({
          type: 'card',
          card: {
            number: cardDetails.cardNumber.replace(/\s/g, ''),
            exp_month: parseInt(expMonth, 10),
            exp_year: parseInt(expYear, 10) + 2000,
            cvc: cardDetails.cvv,
          },
        });

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // amount in cents
          currency: 'lkr',
          payment_method: paymentMethod.id,
          confirm: true,
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        });

        transactionId = paymentIntent.id;
      } catch (stripeError: any) {
        throw new AppError(`Stripe payment failed: ${stripeError.message}`, 400);
      }
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: student.id,
        feeId: targetFee.id,
        amount,
        paymentMethod: method.toUpperCase(),
        paymentStatus: "PENDING",
        invoiceNumber: transactionId,
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

    // Notify student
    await notificationService.createNotification({
      receiverId: student.userId,
      title: 'Payment Successful',
      message: `Your fee payment of Rs. ${amount.toLocaleString()} was processed successfully.`,
      type: 'PAYMENT',
      referenceType: 'PAYMENT',
      referenceId: payment.id,
    });

    return payment;
  }






  static async processPaymentStripe(userId: string, amount: number, method: string, backendUrl: string, redirectUrl?: string) {
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "lkr",
            product_data: {
              name: "Monthly Fee",
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        studentId: student.id,
        feeId: targetFee.id,
        amount: amount.toString(),
        redirectUrl: redirectUrl || '',
      },
      success_url: `${backendUrl}/api/v1/mobile/fees/stripe-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${backendUrl}/api/v1/mobile/fees/stripe-cancel?feeId=${targetFee.id}`,
    });

    return session.url;
  }

  static async confirmPayment(
    paymentIntentId: string,
    amount: number,
    feeId: string,
    studentId: string,
    userId: string
  ) {
    return await prisma.$transaction(async (tx) => {
      // 1. Check if payment already exists
      const existingPayment = await tx.payment.findUnique({
        where: { invoiceNumber: paymentIntentId },
      });

      if (existingPayment) {
        return existingPayment;
      }

      // 2. Retrieve the target fee
      const fee = await tx.fee.findUnique({
        where: { id: feeId },
      });

      if (!fee) {
        throw new AppError('Fee record not found', 404);
      }

      // 3. Create the payment record
      const payment = await tx.payment.create({
        data: {
          studentId,
          feeId,
          amount,
          paymentMethod: 'CARD',
          paymentStatus: 'VERIFIED',
          invoiceNumber: paymentIntentId,
          paymentDate: new Date(),
          verifiedAt: new Date(),
        },
      });

      // 4. Update the fee record
      const newPaid = Number(fee.paid) + amount;
      const status = newPaid >= Number(fee.total) ? 'PAID' : 'PARTIAL';

      await tx.fee.update({
        where: { id: feeId },
        data: {
          paid: newPaid,
          status,
        },
      });

      // 5. Notify student
      try {
        await notificationService.createNotification({
          receiverId: userId,
          title: 'Payment Successful',
          message: `Your fee payment of Rs. ${amount.toLocaleString()} was processed successfully.`,
          type: 'PAYMENT',
          referenceType: 'PAYMENT',
          referenceId: payment.id,
        });
      } catch (notifyErr) {
        console.error('Failed to create payment notification:', notifyErr);
      }

      return payment;
    });
  }

  static async handleStripeSuccess(sessionId: string) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      throw new AppError('Payment not completed', 400);
    }

    const { userId, studentId, feeId, amount, redirectUrl } = session.metadata || {};
    const paymentIntentId = (session.payment_intent as string) || session.id;

    if (!userId || !studentId || !feeId || !amount) {
      throw new AppError('Invalid session metadata', 400);
    }

    const payment = await this.confirmPayment(
      paymentIntentId,
      Number(amount),
      feeId,
      studentId,
      userId
    );

    if (redirectUrl) {
      const separator = redirectUrl.includes('?') ? '&' : '?';
      return `${redirectUrl}${separator}transactionId=${payment.id}&amount=${amount}`;
    }

    const schemeUrl = `pyramideduapp://fees/success?transactionId=${payment.id}&amount=${amount}`;
    return schemeUrl;
  }

  static async handleStripeWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new AppError('Stripe webhook secret is not configured', 500);
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const { userId, studentId, feeId, amount } = session.metadata || {};
      const paymentIntentId = (session.payment_intent as string) || session.id;

      if (userId && studentId && feeId && amount) {
        await this.confirmPayment(
          paymentIntentId,
          Number(amount),
          feeId,
          studentId,
          userId
        );
      }
    }
  }
}
