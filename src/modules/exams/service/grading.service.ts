import prisma from '../../../config/prisma.config';
import { QuestionType, Prisma } from '@prisma/client';

export class GradingService {
  /**
   * Auto-grades MCQ and TRUE_FALSE questions.
   * Calculates total marks and assigns a letter grade.
   */
  async gradeSubmission(
    examId: string,
    studentId: string,
    answers: Record<string, string>
  ) {
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: true },
    });

    if (!exam) throw new Error('Exam not found');

    let totalScore = 0;
    const answerRecords: Prisma.ExamAnswerCreateManySubmissionInput[] = [];
    let hasManualGrading = false;

    for (const question of exam.questions) {
      const studentAnswer = answers[question.id] || '';
      
      let isCorrect = false;
      let marksAwarded = 0;

      if (question.questionType === QuestionType.MCQ || question.questionType === QuestionType.TRUE_FALSE) {
        if (studentAnswer === question.correctAnswer) {
          isCorrect = true;
          marksAwarded = question.marks;
        }
        totalScore += marksAwarded;
      } else if (question.questionType === QuestionType.SHORT_ANSWER) {
        hasManualGrading = true;
        isCorrect = false; // Requires teacher manual review
        marksAwarded = 0;
      }

      answerRecords.push({
        questionId: question.id,
        answer: studentAnswer,
        isCorrect: question.questionType === QuestionType.SHORT_ANSWER ? null : isCorrect,
        marksAwarded,
      });
    }

    const percentage = exam.totalMarks > 0 ? (totalScore / exam.totalMarks) * 100 : 0;
    const gradeLetter = this.calculateLetterGrade(percentage);
    const status = hasManualGrading ? 'PENDING_MANUAL' : 'GRADED';

    return {
      totalScore,
      percentage,
      gradeLetter,
      status,
      answerRecords,
    };
  }

  calculateLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }
}

export const gradingService = new GradingService();
