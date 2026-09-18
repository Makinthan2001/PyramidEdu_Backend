import prisma from '../../../config/prisma.config';
import { DifficultyLevel, PerformanceLevel } from '@prisma/client';

export class PracticeMcqService {
  /**
   * Helper to shuffle an array in place (Fisher-Yates)
   */
  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Gets today's start and end date bounds in UTC
   */
  private getTodayBounds() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfToday, endOfToday };
  }

  /**
   * Checks if student completed today's practice quiz
   */
  async checkTodayStatus(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    const { startOfToday, endOfToday } = this.getTodayBounds();

    const todayResult = await prisma.dailyQuizResult.findFirst({
      where: {
        studentId: student.id,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
    });

    let todayResultPayload = null;
    if (todayResult) {
      const correct = todayResult.correctAnswers;
      let rewardPointsEarned = 0;
      if (correct === 7) rewardPointsEarned = 1;
      else if (correct === 8) rewardPointsEarned = 2;
      else if (correct === 9) rewardPointsEarned = 3;
      else if (correct === 10) rewardPointsEarned = 5;

      const milestones = [7, 14, 30, 50, 100];
      const isMilestone = milestones.includes(student.dailyStreak);

      todayResultPayload = {
        resultId: todayResult.id,
        score: todayResult.score,
        percentage: Number(todayResult.percentage),
        correctAnswers: todayResult.correctAnswers,
        wrongAnswers: todayResult.wrongAnswers,
        rewardPointsEarned,
        totalRewardPoints: student.rewardPoints,
        dailyStreak: student.dailyStreak,
        longestStreak: student.longestStreak,
        isMilestone,
        timeTaken: todayResult.timeTaken,
      };
    }

    return {
      completedToday: !!todayResult,
      dailyStreak: student.dailyStreak,
      longestStreak: student.longestStreak,
      lastPracticeDate: student.lastPracticeDate,
      rewardPoints: student.rewardPoints,
      performanceStatus: student.performanceStatus || PerformanceLevel.AVERAGE,
      todayResult: todayResultPayload,
    };
  }

  /**
   * Generates a new personalized practice quiz
   */
  async generateDailyQuiz(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    const { completedToday } = await this.checkTodayStatus(userId);
    if (completedToday) {
      throw new Error("You have already completed today's practice quiz. Please come back tomorrow.");
    }

    // Fee policy guard (3-month unpaid fee restriction)
    const { FeePolicyService } = await import('../../payments/service/fee-policy.service');
    const feeStatus = await FeePolicyService.getStudentUnpaidFeeDetails(student.id);
    if (feeStatus.isRestricted) {
      await FeePolicyService.enforceThreeMonthPolicy(student.id);
      throw new Error(
        `Practice Quiz restricted due to ${feeStatus.unpaidCount} unpaid fee months. Please settle outstanding balance to continue.`
      );
    }

    const performance = student.performanceStatus || PerformanceLevel.AVERAGE;

    // Determine target counts
    let targetHard = 0;
    let targetMedium = 0;
    let targetEasy = 0;

    switch (performance) {
      case PerformanceLevel.EXCELLENT:
        targetHard = 10;
        break;
      case PerformanceLevel.VERY_GOOD:
        targetHard = 7;
        targetMedium = 3;
        break;
      case PerformanceLevel.GOOD:
        targetHard = 5;
        targetMedium = 5;
        break;
      case PerformanceLevel.AVERAGE:
        targetHard = 3;
        targetMedium = 7;
        break;
      case PerformanceLevel.NEEDS_IMPROVEMENT:
        targetMedium = 6;
        targetEasy = 4;
        break;
      case PerformanceLevel.AT_RISK:
      default:
        targetEasy = 8;
        targetMedium = 2;
        break;
    }

    // Load all MCQ questions from DB
    const allMcqQuestions = await prisma.question.findMany({
      where: {
        exam: {
          examType: 'MCQ',
        },
      },
    });

    if (allMcqQuestions.length < 10) {
      throw new Error('Not enough MCQ questions in the database to generate a quiz.');
    }

    // Separate into pools and shuffle
    const hardPool = this.shuffle(allMcqQuestions.filter(q => q.difficultyLevel === DifficultyLevel.HARD));
    const mediumPool = this.shuffle(allMcqQuestions.filter(q => q.difficultyLevel === DifficultyLevel.MEDIUM));
    const easyPool = this.shuffle(allMcqQuestions.filter(q => q.difficultyLevel === DifficultyLevel.EASY));

    const selectedQuestions: typeof allMcqQuestions = [];

    // Helper to take from a pool
    const takeFromPool = (pool: typeof allMcqQuestions, count: number) => {
      const taken = pool.splice(0, count);
      selectedQuestions.push(...taken);
      return count - taken.length; // return remaining needed (deficit)
    };

    // First pass: try to meet targets
    let hardDeficit = takeFromPool(hardPool, targetHard);
    let mediumDeficit = takeFromPool(mediumPool, targetMedium);
    let easyDeficit = takeFromPool(easyPool, targetEasy);

    // Second pass: handle deficits
    // Handle HARD deficit: take from MEDIUM first, then EASY
    if (hardDeficit > 0) {
      hardDeficit = takeFromPool(mediumPool, hardDeficit);
      if (hardDeficit > 0) {
        hardDeficit = takeFromPool(easyPool, hardDeficit);
      }
    }

    // Handle EASY deficit: take from MEDIUM first, then HARD
    if (easyDeficit > 0) {
      easyDeficit = takeFromPool(mediumPool, easyDeficit);
      if (easyDeficit > 0) {
        easyDeficit = takeFromPool(hardPool, easyDeficit);
      }
    }

    // Handle MEDIUM deficit: take from HARD first, then EASY
    if (mediumDeficit > 0) {
      mediumDeficit = takeFromPool(hardPool, mediumDeficit);
      if (mediumDeficit > 0) {
        mediumDeficit = takeFromPool(easyPool, mediumDeficit);
      }
    }

    // If still have remaining deficit due to pool depletion, fill from whatever is left anywhere
    let totalSelected = selectedQuestions.length;
    if (totalSelected < 10) {
      const remainingNeeded = 10 - totalSelected;
      const leftovers = [...hardPool, ...mediumPool, ...easyPool];
      selectedQuestions.push(...leftovers.slice(0, remainingNeeded));
    }

    // Slice to exactly 10 questions
    const finalQuestions = selectedQuestions.slice(0, 10);

    // Create a new Quiz record
    const quiz = await prisma.quiz.create({
      data: {
        quizTitle: `Daily Practice Quiz - ${new Date().toLocaleDateString()}`,
        totalMarks: 10,
        isPublished: true,
        questions: {
          connect: finalQuestions.map(q => ({ id: q.id })),
        },
      },
      include: {
        questions: true,
      },
    });

    return {
      quizId: quiz.id,
      quizTitle: quiz.quizTitle,
      performanceLevel: performance,
      questions: quiz.questions.map((q, idx) => ({
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        order: idx + 1,
      })),
    };
  }

  /**
   * Submits practice quiz answers
   */
  async submitDailyQuiz(userId: string, data: {
    quizId: string;
    startedAt: string;
    answers: Array<{ questionId: string; selectedAnswer: string }>;
  }) {
    const { quizId, startedAt, answers } = data;

    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    // 1. Check if already completed today
    const { completedToday } = await this.checkTodayStatus(userId);
    if (completedToday) {
      throw new Error("You have already completed today's practice quiz. Please come back tomorrow.");
    }

    // 2. Fetch Quiz with questions to validate
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });

    if (!quiz) {
      throw new Error('Quiz not found.');
    }

    const performance = student.performanceStatus || PerformanceLevel.AVERAGE;
    const totalQuestions = quiz.questions.length;
    let correctAnswersCount = 0;

    const processedAnswers = quiz.questions.map(q => {
      const submission = answers.find(a => a.questionId === q.id);
      const selectedAnswer = submission ? submission.selectedAnswer : '';
      const normCorrect = (q.correctAnswer || '').trim().toLowerCase();
      const normSelected = (selectedAnswer || '').trim().toLowerCase();
      
      let isCorrect = false;
      if (normCorrect !== '' && normCorrect === normSelected) {
        isCorrect = true;
      } else {
        try {
          const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
          if (Array.isArray(options)) {
            options.forEach((opt: any, index: number) => {
              let optLabel = ["a", "b", "c", "d"][index] || String(index + 1);
              let optText = "";

              if (typeof opt === 'string') {
                optText = opt.trim().toLowerCase();
              } else if (opt && typeof opt === 'object') {
                optLabel = (opt.label || optLabel).trim().toLowerCase();
                optText = (opt.text || "").trim().toLowerCase();
              }

              const isSelectedOption = normSelected === optLabel || normSelected === optText;
              const isCorrectOption = normCorrect === optLabel || normCorrect === optText;

              if (isSelectedOption && isCorrectOption) {
                isCorrect = true;
              }
            });
          }
        } catch (e) {
          console.error("Error parsing options in answer check:", e);
        }
      }

      if (isCorrect) {
        correctAnswersCount++;
      }

      return {
        questionId: q.id,
        selectedAnswer,
        isCorrect,
      };
    });

    const wrongAnswersCount = totalQuestions - correctAnswersCount;
    const percentage = (correctAnswersCount / totalQuestions) * 100;
    const score = correctAnswersCount; // 1 mark per question

    // Calculate Reward Points
    let rewardPointsEarned = 0;
    if (correctAnswersCount === 7) rewardPointsEarned = 1;
    else if (correctAnswersCount === 8) rewardPointsEarned = 2;
    else if (correctAnswersCount === 9) rewardPointsEarned = 3;
    else if (correctAnswersCount === 10) rewardPointsEarned = 5;

    // Calculate Streak Updates
    let newStreak = 1;
    const now = new Date();
    const lastDate = student.lastPracticeDate;

    if (lastDate) {
      const lastPractice = new Date(lastDate);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const lastPracticeDateOnly = new Date(lastPractice.getFullYear(), lastPractice.getMonth(), lastPractice.getDate());

      if (lastPracticeDateOnly.getTime() === yesterday.getTime()) {
        newStreak = student.dailyStreak + 1;
      } else if (lastPracticeDateOnly.getTime() === today.getTime()) {
        newStreak = student.dailyStreak; // Same day completion, keep current streak
      }
    }

    const longestStreak = Math.max(student.longestStreak, newStreak);

    // Save and Transactionally update Student Streak, Reward Points, and store Results
    const submittedAt = new Date();
    const timeTaken = Math.max(1, Math.round((submittedAt.getTime() - new Date(startedAt).getTime()) / 1000));

    const result = await prisma.$transaction(async (tx) => {
      // Update student fields
      const updatedStudent = await tx.student.update({
        where: { id: student.id },
        data: {
          rewardPoints: { increment: rewardPointsEarned },
          dailyStreak: newStreak,
          longestStreak: longestStreak,
          lastPracticeDate: submittedAt,
        },
      });

      // Create DailyQuizResult
      const quizResult = await tx.dailyQuizResult.create({
        data: {
          quizId,
          studentId: student.id,
          totalQuestions,
          correctAnswers: correctAnswersCount,
          wrongAnswers: wrongAnswersCount,
          score,
          percentage,
          performanceLevel: performance,
          startedAt: new Date(startedAt),
          submittedAt,
          timeTaken,
          answers: {
            create: processedAnswers.map(ans => ({
              questionId: ans.questionId,
              selectedAnswer: ans.selectedAnswer,
              isCorrect: ans.isCorrect,
            })),
          },
        },
      });

      // Create RewardHistory record if points were earned
      if (rewardPointsEarned > 0) {
        await (tx as any).rewardHistory.create({
          data: {
            studentId: student.id,
            quizId: quizId,
            pointsEarned: rewardPointsEarned,
            totalPointsAfterUpdate: updatedStudent.rewardPoints,
            reason: 'Daily MCQ Practice Reward',
          },
        });
      }

      return {
        quizResult,
        totalRewardPoints: updatedStudent.rewardPoints,
      };
    });

    // Check Streak Milestones
    const milestones = [7, 14, 30, 50, 100];
    const isMilestone = milestones.includes(newStreak);

    return {
      success: true,
      resultId: result.quizResult.id,
      score,
      percentage,
      correctAnswers: correctAnswersCount,
      wrongAnswers: wrongAnswersCount,
      rewardPointsEarned,
      totalRewardPoints: result.totalRewardPoints,
      dailyStreak: newStreak,
      longestStreak,
      isMilestone,
      timeTaken,
    };
  }

  /**
   * Fetches all quiz attempt history for a student
   */
  async getStudentQuizHistory(userId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    const results = await prisma.dailyQuizResult.findMany({
      where: { studentId: student.id },
      include: { quiz: true },
      orderBy: { createdAt: 'desc' },
    });

    return results.map(r => {
      const correct = r.correctAnswers;
      let rewardPointsEarned = 0;
      if (correct === 7) rewardPointsEarned = 1;
      else if (correct === 8) rewardPointsEarned = 2;
      else if (correct === 9) rewardPointsEarned = 3;
      else if (correct === 10) rewardPointsEarned = 5;

      return {
        id: r.id,
        quizTitle: r.quiz.quizTitle,
        score: r.score,
        percentage: Number(r.percentage),
        correctAnswers: r.correctAnswers,
        wrongAnswers: r.wrongAnswers,
        rewardPointsEarned,
        timeTaken: r.timeTaken,
        submittedAt: r.submittedAt,
      };
    });
  }

  /**
   * Fetches a specific quiz history attempt detail
   */
  async getStudentQuizHistoryDetail(userId: string, resultId: string) {
    const student = await prisma.student.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new Error('Student record not found.');
    }

    const result = await prisma.dailyQuizResult.findFirst({
      where: { id: resultId, studentId: student.id },
      include: {
        quiz: {
          include: {
            questions: true,
          },
        },
        answers: true,
      },
    });

    if (!result) {
      throw new Error('Quiz result not found.');
    }

    const correct = result.correctAnswers;
    let rewardPointsEarned = 0;
    if (correct === 7) rewardPointsEarned = 1;
    else if (correct === 8) rewardPointsEarned = 2;
    else if (correct === 9) rewardPointsEarned = 3;
    else if (correct === 10) rewardPointsEarned = 5;

    const questionsWithAnswers = result.quiz.questions.map(q => {
      const answer = result.answers.find(a => a.questionId === q.id);
      return {
        questionId: q.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        selectedAnswer: answer ? answer.selectedAnswer : '',
        isCorrect: answer ? answer.isCorrect : false,
      };
    });

    return {
      resultId: result.id,
      quizTitle: result.quiz.quizTitle,
      score: result.score,
      percentage: Number(result.percentage),
      correctAnswers: result.correctAnswers,
      wrongAnswers: result.wrongAnswers,
      rewardPointsEarned,
      totalRewardPoints: student.rewardPoints,
      dailyStreak: student.dailyStreak,
      longestStreak: student.longestStreak,
      timeTaken: result.timeTaken,
      submittedAt: result.submittedAt,
      questions: questionsWithAnswers,
    };
  }
}
