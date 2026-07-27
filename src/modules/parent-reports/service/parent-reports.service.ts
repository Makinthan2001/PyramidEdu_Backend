import prisma from '../../../config/prisma.config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { sendEmail } from '../../../utils/email.util';
import { AppError } from '../../../utils/AppError';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface GenerationResult {
  studentId: string;
  studentName: string;
  success: boolean;
  score?: number;
  skipped?: boolean;
  error?: string;
}

export class ParentReportsService {
  /**
   * Generates parent reports for all active students with parents for a specific month and year
   */
  static async generateMonthlyReports(month: number, year: number, generatedBy: 'AUTOMATIC' | 'MANUAL' = 'AUTOMATIC'): Promise<GenerationResult[]> {
    if (month < 1 || month > 12) {
      throw new AppError('Invalid month. Must be between 1 and 12.', 400);
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Fetch active students with parents
    const students = await prisma.student.findMany({
      where: {
        parentId: { not: null },
        user: {
          status: 'ACTIVE',
          isActive: true,
        },
      },
      include: {
        user: true,
        parent: true,
      },
    });

    const results: GenerationResult[] = [];

    for (const student of students) {
      try {
        const studentId = student.id;
        const parent = student.parent;
        if (!parent) continue;

        // Check if report already exists for this student and this month/year period
        const existingReport = await prisma.parentReport.findFirst({
          where: {
            studentId,
            generatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        if (existingReport) {
          results.push({
            studentId,
            studentName: student.user.fullName,
            success: true,
            skipped: true,
            score: Number(existingReport.performanceScore ?? 0),
          });
          continue;
        }

        // Fetch attendance for this month
        const attendances = await prisma.attendance.findMany({
          where: {
            studentId,
            attendanceDate: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        const totalSessions = attendances.length;
        const presentSessions = attendances.filter(
          (a) => a.isPresent || a.attendanceStatus === 'PRESENT' || a.attendanceStatus === 'LATE'
        ).length;
        const attendancePercentage = totalSessions > 0 ? (presentSessions / totalSessions) * 100 : 100.0;

        // Fetch academic results for this month
        const resultsData = await prisma.result.findMany({
          where: {
            studentId,
            recordedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        });

        const quizMarks = resultsData.filter((r) => r.quizId !== null).map((r) => Number(r.marks));
        const examMarks = resultsData.filter((r) => r.examId !== null).map((r) => Number(r.marks));

        // Fetch assignment submissions (removed table)
        const assignmentSubmissions: any[] = [];
        const assignmentMarks: number[] = [];

        // Calculate averages (default to 75 if no submissions exist for that month)
        const quizAverage = quizMarks.length > 0 ? quizMarks.reduce((a, b) => a + b, 0) / quizMarks.length : 75.0;
        const examAverage = examMarks.length > 0 ? examMarks.reduce((a, b) => a + b, 0) / examMarks.length : 75.0;
        const assignmentAverage = assignmentMarks.length > 0 ? assignmentMarks.reduce((a, b) => a + b, 0) / assignmentMarks.length : 75.0;

        // Calculate overall weighted score
        // Formula: (attendance × 0.30) + (quiz × 0.20) + (assignment × 0.20) + (exam × 0.30)
        const weightedScore =
          attendancePercentage * 0.3 +
          quizAverage * 0.2 +
          assignmentAverage * 0.2 +
          examAverage * 0.3;

        // Detect Trend
        const lastReports = await prisma.parentReport.findMany({
          where: { studentId },
          orderBy: { generatedAt: 'desc' },
          take: 1,
        });

        let trend = 'STABLE';
        if (lastReports.length > 0 && lastReports[0].performanceScore) {
          const prevScore = Number(lastReports[0].performanceScore);
          if (weightedScore >= prevScore + 2) {
            trend = 'IMPROVING';
          } else if (weightedScore <= prevScore - 2) {
            trend = 'DECLINING';
          }
        }

        // Call Gemini service for recommendation
        let recommendation = '';
        try {
          const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
          const prompt = `You are a professional educational counselor at PyramidEdu. Generate a personalized academic recommendation for the parents of ${student.user.fullName}.
Monthly Academic Metrics:
- Attendance: ${attendancePercentage.toFixed(1)}%
- Quiz Average: ${quizAverage.toFixed(1)}%
- Assignment Average: ${assignmentAverage.toFixed(1)}%
- Exam Average: ${examAverage.toFixed(1)}%
- Overall Weighted Score: ${weightedScore.toFixed(1)}%
- Performance Trend: ${trend}

Provide 2-3 encouraging, realistic, and actionable sentences (no markdown, plain text only) advising parents how they can support their child's education based on these metrics. Speak about the child respectfully.`;

          const aiResponse = await model.generateContent(prompt);
          recommendation = aiResponse.response.text().trim();
        } catch (aiErr) {
          console.error(`Gemini recommendation generation failed for student ${studentId}:`, aiErr);
          recommendation = `${student.user.fullName} is showing a ${trend.toLowerCase()} trend. Please ensure regular attendance and timely completion of coursework to maintain academic growth.`;
        }

        // Save report in database
        const attendanceSummary = `Attendance: ${attendancePercentage.toFixed(0)}%, Quiz: ${quizAverage.toFixed(0)}%, Assignment: ${assignmentAverage.toFixed(0)}%, Exam: ${examAverage.toFixed(0)}%`;
        const report = await prisma.parentReport.create({
          data: {
            studentId,
            parentId: parent.id,
            attendanceSummary,
            performanceScore: weightedScore,
            trendAnalysis: trend,
            aiRecommendation: recommendation,
            isActive: true,
            isSent: false,
            // Store generation metadata in trendAnalysis or description if available,
            // but we can also store the 'generatedBy' info in trendAnalysis: 'TREND | GENERATED_BY' or just keep it simple.
            // Let's store "AUTOMATIC" or "MANUAL" in paymentDate or another unused field, or simply prefix trend analysis:
            // "STABLE (AUTOMATIC)"
            paymentDate: generatedBy === 'AUTOMATIC' ? new Date(0) : null, // Mark automatic reports using epoch date
            generatedAt: new Date(year, month, 0, 12, 0, 0),
          },
        });

        // Call Email Service if parent has email registered
        let isEmailSent = false;
        if (parent.email) {
          try {
            const monthNames = [
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ];
            const monthName = monthNames[month - 1];

            const htmlContent = `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1a202c; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #34d399; padding-bottom: 15px;">
                  <h1 style="color: #059669; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">PyramidEdu Report Card</h1>
                  <p style="color: #718096; margin: 5px 0 0 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Monthly Performance Summary</p>
                </div>
                
                <p style="font-size: 16px; line-height: 1.6; color: #4a5568;">Dear <strong>${parent.parentName}</strong>,</p>
                <p style="font-size: 15px; line-height: 1.6; color: #4a5568; margin-bottom: 25px;">
                  Here is the academic performance report for your child, <strong>${student.user.fullName}</strong> (Index: ${student.indexNumber || 'N/A'}), for the month of <strong>${monthName} ${year}</strong>.
                </p>

                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 25px; background-color: #f7fafc; padding: 20px; border-radius: 12px;">
                  <div style="padding: 10px; border-right: 1px solid #edf2f7;">
                    <span style="font-size: 12px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Attendance</span>
                    <p style="font-size: 20px; font-weight: 700; color: #2d3748; margin: 5px 0 0 0;">${attendancePercentage.toFixed(1)}%</p>
                  </div>
                  <div style="padding: 10px;">
                    <span style="font-size: 12px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Weighted Score</span>
                    <p style="font-size: 20px; font-weight: 700; color: #059669; margin: 5px 0 0 0;">${weightedScore.toFixed(1)}%</p>
                  </div>
                  <div style="padding: 10px; border-right: 1px solid #edf2f7; border-top: 1px solid #edf2f7;">
                    <span style="font-size: 12px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Trend Status</span>
                    <p style="font-size: 15px; font-weight: 700; color: ${trend === 'IMPROVING' ? '#059669' : trend === 'DECLINING' ? '#e53e3e' : '#3182ce'}; margin: 5px 0 0 0;">${trend}</p>
                  </div>
                  <div style="padding: 10px; border-top: 1px solid #edf2f7;">
                    <span style="font-size: 12px; font-weight: 700; color: #a0aec0; text-transform: uppercase;">Performance Status</span>
                    <p style="font-size: 15px; font-weight: 700; color: #2d3748; margin: 5px 0 0 0;">${weightedScore >= 75 ? 'Excellent' : weightedScore >= 60 ? 'Good' : 'Average'}</p>
                  </div>
                </div>

                <div style="background-color: #f0fdf4; border-left: 4px solid #34d399; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px;">
                  <h3 style="color: #065f46; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">AI Counselor Recommendation</h3>
                  <p style="font-size: 14px; line-height: 1.6; color: #0f5132; margin: 0; font-style: italic;">"${recommendation}"</p>
                </div>

                <p style="font-size: 13px; color: #a0aec0; text-align: center; border-top: 1px solid #edf2f7; padding-top: 15px; margin-top: 30px;">
                  This is an automated report from PyramidEdu Portal. Do not reply to this email.
                </p>
              </div>
            `;

            await sendEmail(parent.email, `Monthly Academic Report - ${monthName} ${year}`, htmlContent);
            isEmailSent = true;
          } catch (emailErr) {
            console.error(`Failed to send report email to parent for student ${studentId}:`, emailErr);
          }
        }

        // Update isSent if email dispatch was successful
        if (isEmailSent) {
          await prisma.parentReport.update({
            where: { id: report.id },
            data: { isSent: true },
          });
        }

        results.push({
          studentId,
          studentName: student.user.fullName,
          success: true,
          score: weightedScore,
        });
      } catch (studentErr: any) {
        console.error(`Failed to generate monthly report for student ${student.id}:`, studentErr);
        results.push({
          studentId: student.id,
          studentName: student.user.fullName,
          success: false,
          error: studentErr?.message || 'Unknown generation error',
        });
      }
    }

    return results;
  }

  /**
   * Retrieves generated parent reports filtered by month and year
   */
  static async getAllReports(month: number, year: number) {
    const reports = await prisma.parentReport.findMany({
      where: {
        generatedAt: {
          gte: new Date(year, month - 1, 1),
          lte: new Date(year, month, 0, 23, 59, 59, 999),
        },
      },
      include: {
        student: {
          include: {
            user: true,
            stream: true,
            batchRecord: true,
          },
        },
        parent: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    return reports.map((report) => ({
      id: report.id,
      studentId: report.studentId,
      studentName: report.student.user.fullName,
      indexNumber: report.student.indexNumber,
      parentName: report.parent.parentName,
      parentEmail: report.parent.email,
      attendanceSummary: report.attendanceSummary,
      performanceScore: Number(report.performanceScore ?? 0),
      trendAnalysis: report.trendAnalysis,
      aiRecommendation: report.aiRecommendation,
      isSent: report.isSent,
      generatedAt: report.generatedAt,
      // If paymentDate is epoch, it was generated automatically
      generatedBy: report.paymentDate && report.paymentDate.getTime() === 0 ? 'AUTOMATIC' : 'MANUAL',
      batchName: report.student.batchRecord?.batchName || report.student.batch || '—',
      streamName: report.student.stream?.streamName || '—'
    }));
  }

  /**
   * Retrieves report history for a specific student
   */
  static async getStudentReports(studentId: string) {
    const reports = await prisma.parentReport.findMany({
      where: { studentId },
      include: {
        parent: true,
      },
      orderBy: { generatedAt: 'desc' },
    });

    return reports.map((report) => ({
      id: report.id,
      attendanceSummary: report.attendanceSummary,
      performanceScore: Number(report.performanceScore ?? 0),
      trendAnalysis: report.trendAnalysis,
      aiRecommendation: report.aiRecommendation,
      isSent: report.isSent,
      generatedAt: report.generatedAt,
      generatedBy: report.paymentDate && report.paymentDate.getTime() === 0 ? 'AUTOMATIC' : 'MANUAL'
    }));
  }
}
