import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';
import { PaymentStatus, FeeStatus } from '@prisma/client';

export interface PaymentFilters {
  search?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  subjectId?: string;
  batchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StudentSummaryFilters {
  search?: string;
  batchId?: string;
  subjectId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class PaymentService {
  /**
   * Get overall Dashboard Overview metrics for Payments
   */
  static async getDashboardOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    // 1. Total Revenue / Total Collected (Sum of VERIFIED payments)
    const verifiedRevenueAggregate = await prisma.payment.aggregate({
      where: {
        paymentStatus: 'VERIFIED',
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    });
    const totalRevenue = Number(verifiedRevenueAggregate._sum.amount || 0);

    // 2. Total Outstanding Amount (Sum of total - paid on active fees)
    const allFees = await prisma.fee.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        total: true,
        paid: true,
        status: true,
      },
    });

    let totalOutstandingAmount = 0;
    allFees.forEach((fee) => {
      if (fee.status !== 'PAID') {
        const diff = Number(fee.total) - Number(fee.paid);
        if (diff > 0) totalOutstandingAmount += diff;
      }
    });

    // 3. Payment Status Counts
    const paymentStatusCounts = await prisma.payment.groupBy({
      by: ['paymentStatus'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const statusMap: Record<string, number> = {};
    paymentStatusCounts.forEach((sc) => {
      statusMap[sc.paymentStatus] = sc._count.id;
    });

    const totalPendingPayments = statusMap['PENDING'] || 0;
    const totalVerifiedPayments = statusMap['VERIFIED'] || 0;
    const totalRejectedPayments = statusMap['REJECTED'] || 0;
    const totalRefundedPayments = statusMap['REFUNDED'] || 0;

    // 4. Students with Pending Fees & Overdue Fees
    const pendingFeeStudents = await prisma.fee.groupBy({
      by: ['studentId'],
      where: {
        status: { in: ['UNPAID', 'PARTIAL'] },
        deletedAt: null,
      },
    });

    const overdueFeeStudents = await prisma.fee.groupBy({
      by: ['studentId'],
      where: {
        status: 'OVERDUE',
        deletedAt: null,
      },
    });

    const totalStudentsPendingFees = pendingFeeStudents.length;
    const totalStudentsOverdueFees = overdueFeeStudents.length;

    // 5. Monthly Revenue (Current Month)
    const monthlyRevenueAggregate = await prisma.payment.aggregate({
      where: {
        paymentStatus: 'VERIFIED',
        deletedAt: null,
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: {
        amount: true,
      },
    });
    const monthlyRevenue = Number(monthlyRevenueAggregate._sum.amount || 0);

    // 6. Today's Collections
    const todayCollectionsAggregate = await prisma.payment.aggregate({
      where: {
        paymentStatus: 'VERIFIED',
        deletedAt: null,
        paymentDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        amount: true,
      },
    });
    const todayCollections = Number(todayCollectionsAggregate._sum.amount || 0);

    return {
      totalRevenue,
      totalAmountCollected: totalRevenue,
      totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
      totalPendingPayments,
      totalVerifiedPayments,
      totalRejectedPayments,
      totalRefundedPayments,
      totalStudentsPendingFees,
      totalStudentsOverdueFees,
      monthlyRevenue,
      todayCollections,
    };
  }

  /**
   * Get analytics datasets for charts
   */
  static async getAnalytics(filters: PaymentFilters) {
    const now = new Date();
    
    // 1. Monthly Revenue Trend (Last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const paymentsForTrend = await prisma.payment.findMany({
      where: {
        paymentStatus: 'VERIFIED',
        deletedAt: null,
        paymentDate: { gte: sixMonthsAgo },
      },
      select: {
        amount: true,
        paymentDate: true,
      },
      orderBy: { paymentDate: 'asc' },
    });

    const monthlyIncomeMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthlyIncomeMap[label] = 0;
    }

    paymentsForTrend.forEach((p) => {
      const label = new Date(p.paymentDate).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthlyIncomeMap[label] = (monthlyIncomeMap[label] || 0) + Number(p.amount);
    });

    const monthlyRevenueTrend = Object.keys(monthlyIncomeMap).map((month) => ({
      month,
      revenue: Number(monthlyIncomeMap[month].toFixed(2)),
    }));

    // 2. Daily Collection Trend (Last 14 days)
    const fourteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    const dailyPayments = await prisma.payment.findMany({
      where: {
        paymentStatus: 'VERIFIED',
        deletedAt: null,
        paymentDate: { gte: fourteenDaysAgo },
      },
      select: {
        amount: true,
        paymentDate: true,
      },
    });

    const dailyIncomeMap: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyIncomeMap[label] = 0;
    }

    dailyPayments.forEach((p) => {
      const label = new Date(p.paymentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyIncomeMap[label] = (dailyIncomeMap[label] || 0) + Number(p.amount);
    });

    const dailyCollectionTrend = Object.keys(dailyIncomeMap).map((date) => ({
      date,
      amount: Number(dailyIncomeMap[date].toFixed(2)),
    }));

    // 3. Payment Status Distribution
    const statusGroups = await prisma.payment.groupBy({
      by: ['paymentStatus'],
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { amount: true },
    });

    const paymentStatusDistribution = statusGroups.map((sg) => ({
      status: sg.paymentStatus,
      count: sg._count.id,
      amount: Number(sg._sum.amount || 0),
    }));

    // 4. Payment Method Distribution
    const methodGroups = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { amount: true },
    });

    const paymentMethodDistribution = methodGroups.map((mg) => ({
      method: mg.paymentMethod || 'UNKNOWN',
      count: mg._count.id,
      amount: Number(mg._sum.amount || 0),
    }));

    // 5. Fee Collection Progress
    const feeTotals = await prisma.fee.aggregate({
      where: { deletedAt: null },
      _sum: {
        total: true,
        paid: true,
      },
    });

    const totalFeesGenerated = Number(feeTotals._sum.total || 0);
    const totalFeesCollected = Number(feeTotals._sum.paid || 0);
    const totalOutstanding = Math.max(0, totalFeesGenerated - totalFeesCollected);

    const feeCollectionProgress = {
      totalGenerated: totalFeesGenerated,
      totalCollected: totalFeesCollected,
      totalOutstanding,
      collectionPercentage: totalFeesGenerated > 0 ? Number(((totalFeesCollected / totalFeesGenerated) * 100).toFixed(1)) : 0,
    };

    // 6. Monthly Outstanding Amount Trend
    const feesWithBalance = await prisma.fee.findMany({
      where: {
        deletedAt: null,
        status: { not: 'PAID' },
      },
      select: {
        total: true,
        paid: true,
        monthYear: true,
      },
    });

    const monthlyOutstandingMap: Record<string, number> = {};
    feesWithBalance.forEach((f) => {
      const label = new Date(f.monthYear).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const remaining = Number(f.total) - Number(f.paid);
      if (remaining > 0) {
        monthlyOutstandingMap[label] = (monthlyOutstandingMap[label] || 0) + remaining;
      }
    });

    const monthlyOutstandingAmount = Object.keys(monthlyOutstandingMap).map((month) => ({
      month,
      outstanding: Number(monthlyOutstandingMap[month].toFixed(2)),
    }));

    // 7. Revenue by Subject
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      include: {
        enrollments: {
          include: {
            student: {
              include: {
                payments: {
                  where: { paymentStatus: 'VERIFIED', deletedAt: null },
                },
              },
            },
          },
        },
      },
    });

    const revenueBySubject = subjects.map((sub) => {
      let revenue = 0;
      sub.enrollments.forEach((e) => {
        e.student.payments.forEach((p) => {
          revenue += Number(p.amount);
        });
      });
      return {
        subjectName: sub.subjectName,
        subjectCode: sub.subjectCode,
        revenue: Number(revenue.toFixed(2)),
      };
    });

    // 8. Revenue by Batch
    const batches = await prisma.batch.findMany({
      where: { isActive: true },
      include: {
        students: {
          include: {
            payments: {
              where: { paymentStatus: 'VERIFIED', deletedAt: null },
            },
          },
        },
      },
    });

    const revenueByBatch = batches.map((b) => {
      let revenue = 0;
      b.students.forEach((s) => {
        s.payments.forEach((p) => {
          revenue += Number(p.amount);
        });
      });
      return {
        batchName: b.batchName,
        revenue: Number(revenue.toFixed(2)),
      };
    });

    return {
      monthlyRevenueTrend,
      dailyCollectionTrend,
      paymentStatusDistribution,
      paymentMethodDistribution,
      feeCollectionProgress,
      monthlyOutstandingAmount,
      revenueBySubject,
      revenueByBatch,
    };
  }

  /**
   * Get paginated payment records for Payment Management Table
   */
  static async getPayments(filters: PaymentFilters) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Number(filters.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    // Filter by Payment Status
    if (filters.paymentStatus && filters.paymentStatus !== 'ALL') {
      where.paymentStatus = filters.paymentStatus as PaymentStatus;
    }

    // Filter by Payment Method
    if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
      where.paymentMethod = filters.paymentMethod;
    }

    // Filter by Date Range
    if (filters.startDate || filters.endDate) {
      where.paymentDate = {};
      if (filters.startDate) where.paymentDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.paymentDate.lte = new Date(filters.endDate);
    }

    const studentWhere: any = {};

    if (filters.batchId && filters.batchId !== 'ALL') {
      studentWhere.batchId = filters.batchId;
    }

    if (filters.subjectId && filters.subjectId !== 'ALL') {
      studentWhere.enrollments = {
        some: { subjectId: filters.subjectId },
      };
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        {
          student: {
            OR: [
              { indexNumber: { contains: term, mode: 'insensitive' } },
              { user: { fullName: { contains: term, mode: 'insensitive' } } },
              { user: { email: { contains: term, mode: 'insensitive' } } },
            ],
          },
        },
      ];
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = { ...where.student, ...studentWhere };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          fee: true,
          student: {
            include: {
              user: true,
              batchRecord: true,
              enrollments: {
                include: { subject: true },
              },
            },
          },
        },
        orderBy: filters.sortBy ? { [filters.sortBy]: filters.sortOrder || 'desc' } : { paymentDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    const items = payments.map((p) => {
      const subjects = p.student.enrollments.map((e) => e.subject.subjectName).join(', ') || 'General';
      return {
        id: p.id,
        studentId: p.studentId,
        studentName: p.student.user.fullName,
        indexNumber: p.student.indexNumber || '—',
        email: p.student.user.email,
        subject: subjects,
        batch: p.student.batchRecord?.batchName || p.student.batch || 'Unassigned',
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        invoiceNumber: p.invoiceNumber || `INV-${p.id.slice(0, 8)}`,
        paymentDate: p.paymentDate,
        verifiedBy: p.verifiedBy || (p.paymentStatus === 'VERIFIED' ? 'System Admin' : '—'),
        verifiedAt: p.verifiedAt || (p.paymentStatus === 'VERIFIED' ? p.updatedAt : null),
        feeMonth: p.fee ? p.fee.monthYear : null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get dedicated Fee Overview statistics, recent payments, upcoming dues, overdue students
   */
  static async getFeeOverview() {
    const fees = await prisma.fee.findMany({
      where: { deletedAt: null },
      include: {
        student: {
          include: { user: true, batchRecord: true },
        },
      },
    });

    let totalFeesGenerated = 0;
    let totalFeesCollected = 0;
    let outstandingFees = 0;
    let overdueFees = 0;
    let paidFeesCount = 0;
    let unpaidFeesCount = 0;
    let partialPaymentsCount = 0;
    let overdueFeesCount = 0;

    fees.forEach((f) => {
      const tot = Number(f.total);
      const pd = Number(f.paid);
      const rem = Math.max(0, tot - pd);

      totalFeesGenerated += tot;
      totalFeesCollected += pd;

      if (f.status === 'PAID') {
        paidFeesCount++;
      } else if (f.status === 'UNPAID') {
        unpaidFeesCount++;
        outstandingFees += rem;
      } else if (f.status === 'PARTIAL') {
        partialPaymentsCount++;
        outstandingFees += rem;
      } else if (f.status === 'OVERDUE') {
        overdueFeesCount++;
        overdueFees += rem;
        outstandingFees += rem;
      }
    });

    // Recent Payments (Latest 10)
    const recentPaymentsRaw = await prisma.payment.findMany({
      where: { deletedAt: null },
      include: {
        student: { include: { user: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take: 10,
    });

    const recentPayments = recentPaymentsRaw.map((p) => ({
      id: p.id,
      studentName: p.student.user.fullName,
      indexNumber: p.student.indexNumber || '—',
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      invoiceNumber: p.invoiceNumber || `INV-${p.id.slice(0, 8)}`,
      paymentDate: p.paymentDate,
    }));

    // Upcoming Due Payments
    const upcomingDueFeesRaw = await prisma.fee.findMany({
      where: {
        deletedAt: null,
        status: { in: ['UNPAID', 'PARTIAL'] },
      },
      include: {
        student: { include: { user: true } },
      },
      orderBy: { monthYear: 'asc' },
      take: 10,
    });

    const upcomingDuePayments = upcomingDueFeesRaw.map((f) => ({
      feeId: f.id,
      studentName: f.student.user.fullName,
      indexNumber: f.student.indexNumber || '—',
      amountDue: Number(f.total) - Number(f.paid),
      monthYear: f.monthYear,
      dueDate: f.dueDate || f.monthYear,
      status: f.status,
    }));

    // Overdue Students
    const overdueFeesRaw = await prisma.fee.findMany({
      where: {
        deletedAt: null,
        status: 'OVERDUE',
      },
      include: {
        student: { include: { user: true, batchRecord: true } },
      },
      orderBy: { monthYear: 'asc' },
      take: 10,
    });

    const overdueStudents = overdueFeesRaw.map((f) => ({
      studentId: f.studentId,
      studentName: f.student.user.fullName,
      indexNumber: f.student.indexNumber || '—',
      batch: f.student.batchRecord?.batchName || f.student.batch || 'Unassigned',
      amountDue: Number(f.total) - Number(f.paid),
      monthYear: f.monthYear,
      dueDate: f.dueDate || f.monthYear,
    }));

    return {
      totalFeesGenerated: Number(totalFeesGenerated.toFixed(2)),
      totalFeesCollected: Number(totalFeesCollected.toFixed(2)),
      outstandingFees: Number(outstandingFees.toFixed(2)),
      overdueFees: Number(overdueFees.toFixed(2)),
      paidFeesCount,
      unpaidFeesCount,
      partialPaymentsCount,
      overdueFeesCount,
      recentPayments,
      upcomingDuePayments,
      overdueStudents,
    };
  }

  /**
   * Get Student Payment Summaries table
   */
  static async getStudentSummaries(filters: StudentSummaryFilters) {
    const page = Math.max(1, Number(filters.page || 1));
    const limit = Math.max(1, Number(filters.limit || 10));
    const skip = (page - 1) * limit;

    const studentWhere: any = {};

    if (filters.batchId && filters.batchId !== 'ALL') {
      studentWhere.batchId = filters.batchId;
    }

    if (filters.subjectId && filters.subjectId !== 'ALL') {
      studentWhere.enrollments = {
        some: { subjectId: filters.subjectId },
      };
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      studentWhere.OR = [
        { indexNumber: { contains: term, mode: 'insensitive' } },
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { email: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where: studentWhere,
        include: {
          user: true,
          batchRecord: true,
          fees: {
            orderBy: { monthYear: 'desc' },
          },
          payments: {
            where: { deletedAt: null },
            orderBy: { paymentDate: 'desc' },
          },
        },
        skip,
        take: limit,
      }),
      prisma.student.count({ where: studentWhere }),
    ]);

    const items = students.map((s) => {
      const latestFee = s.fees[0];
      const totalFee = latestFee ? Number(latestFee.total) : Number(s.totalFeeAmount || 0);
      const totalPaid = latestFee ? Number(latestFee.paid) : (s.paymentStatus === 'PAID' ? totalFee : 0);
      const remainingBalance = Math.max(0, totalFee - totalPaid);
      const paymentStatus = latestFee ? latestFee.status : (remainingBalance === 0 ? 'PAID' : 'UNPAID');
      const lastPayment = s.payments[0];

      return {
        studentId: s.id,
        userId: s.userId,
        studentName: s.user.fullName,
        indexNumber: s.indexNumber || '—',
        email: s.user.email,
        batchName: s.batchRecord?.batchName || s.batch || 'Unassigned',
        totalFee,
        totalPaid,
        remainingBalance,
        paymentStatus,
        lastPaymentDate: lastPayment ? lastPayment.paymentDate : null,
        dueDate: latestFee?.dueDate || latestFee?.monthYear || null,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get detailed payment information for single payment modal (supports both paymentId and studentId)
   */
  static async getPaymentDetails(id: string) {
    let payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        fee: true,
        student: {
          include: {
            user: true,
            batchRecord: true,
            stream: true,
            fees: { orderBy: { monthYear: 'desc' } },
            payments: { orderBy: { paymentDate: 'desc' } },
          },
        },
      },
    });

    if (payment) {
      return {
        studentInfo: {
          id: payment.student.id,
          name: payment.student.user.fullName,
          indexNumber: payment.student.indexNumber || '—',
          email: payment.student.user.email,
          phone: payment.student.phone || payment.student.user.phone || '—',
          batch: payment.student.batchRecord?.batchName || payment.student.batch || 'Unassigned',
          stream: payment.student.stream?.streamName || '—',
          profileImage: payment.student.user.profileImage,
        },
        feeInfo: {
          id: payment.fee?.id || null,
          monthYear: payment.fee?.monthYear || payment.paymentDate,
          totalAmount: payment.fee ? Number(payment.fee.total) : Number(payment.amount),
          paidAmount: payment.fee ? Number(payment.fee.paid) : Number(payment.amount),
          outstanding: payment.fee ? Math.max(0, Number(payment.fee.total) - Number(payment.fee.paid)) : 0,
          status: payment.fee?.status || 'PAID',
          dueDate: payment.fee?.dueDate || null,
        },
        paymentInfo: {
          id: payment.id,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          paymentStatus: payment.paymentStatus,
          invoiceNumber: payment.invoiceNumber || `INV-${payment.id.slice(0, 8)}`,
          paymentDate: payment.paymentDate,
        },
        verificationInfo: {
          verifiedBy: payment.verifiedBy || (payment.paymentStatus === 'VERIFIED' ? 'System Administrator' : null),
          verifiedAt: payment.verifiedAt || (payment.paymentStatus === 'VERIFIED' ? payment.updatedAt : null),
        },
        paymentHistory: payment.student.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          paymentStatus: p.paymentStatus,
          invoiceNumber: p.invoiceNumber || `INV-${p.id.slice(0, 8)}`,
          paymentDate: p.paymentDate,
        })),
      };
    }

    // Fallback: If ID is a studentId
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        user: true,
        batchRecord: true,
        stream: true,
        fees: { orderBy: { monthYear: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
      },
    });

    if (!student) {
      throw new AppError('Payment or student record not found.', 404);
    }

    const latestFee = student.fees[0];
    const latestPayment = student.payments[0];

    return {
      studentInfo: {
        id: student.id,
        name: student.user.fullName,
        indexNumber: student.indexNumber || '—',
        email: student.user.email,
        phone: student.phone || student.user.phone || '—',
        batch: student.batchRecord?.batchName || student.batch || 'Unassigned',
        stream: student.stream?.streamName || '—',
        profileImage: student.user.profileImage,
      },
      feeInfo: {
        id: latestFee?.id || null,
        monthYear: latestFee?.monthYear || new Date(),
        totalAmount: latestFee ? Number(latestFee.total) : Number(student.totalFeeAmount || 0),
        paidAmount: latestFee ? Number(latestFee.paid) : (student.paymentStatus === 'PAID' ? Number(student.totalFeeAmount || 0) : 0),
        outstanding: latestFee ? Math.max(0, Number(latestFee.total) - Number(latestFee.paid)) : Number(student.totalFeeAmount || 0),
        status: latestFee?.status || 'UNPAID',
        dueDate: latestFee?.dueDate || null,
      },
      paymentInfo: {
        id: latestPayment?.id || 'N/A',
        amount: latestPayment ? Number(latestPayment.amount) : 0,
        paymentMethod: latestPayment?.paymentMethod || 'N/A',
        paymentStatus: latestPayment?.paymentStatus || 'PENDING',
        invoiceNumber: latestPayment ? (latestPayment.invoiceNumber || `INV-${latestPayment.id.slice(0, 8)}`) : 'N/A',
        paymentDate: latestPayment ? latestPayment.paymentDate : new Date(),
      },
      verificationInfo: {
        verifiedBy: latestPayment?.verifiedBy || (latestPayment?.paymentStatus === 'VERIFIED' ? 'System Administrator' : null),
        verifiedAt: latestPayment?.verifiedAt || (latestPayment?.paymentStatus === 'VERIFIED' ? latestPayment.updatedAt : null),
      },
      paymentHistory: student.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        paymentStatus: p.paymentStatus,
        invoiceNumber: p.invoiceNumber || `INV-${p.id.slice(0, 8)}`,
        paymentDate: p.paymentDate,
      })),
    };
  }


  /**
   * Update Payment verification status
   */
  static async updatePaymentStatus(id: string, status: PaymentStatus, verifierName: string = 'Admin') {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { fee: true },
    });

    if (!payment) {
      throw new AppError('Payment not found.', 404);
    }

    const updatedPayment = await prisma.payment.update({
      where: { id },
      data: {
        paymentStatus: status,
        verifiedBy: status === 'VERIFIED' ? verifierName : payment.verifiedBy,
        verifiedAt: status === 'VERIFIED' ? new Date() : payment.verifiedAt,
      },
    });

    if (payment.feeId) {
      if (status === 'VERIFIED') {
        const fee = await prisma.fee.findUnique({ where: { id: payment.feeId } });
        if (fee) {
          const newPaid = Number(fee.paid) + Number(payment.amount);
          const feeStatus: FeeStatus = newPaid >= Number(fee.total) ? 'PAID' : 'PARTIAL';
          await prisma.fee.update({
            where: { id: fee.id },
            data: {
              paid: newPaid,
              status: feeStatus,
            },
          });
        }
      }
    }

    return updatedPayment;
  }
}
