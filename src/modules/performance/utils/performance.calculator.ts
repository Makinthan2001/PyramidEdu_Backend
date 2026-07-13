import {
  DEFAULT_WEIGHTS,
  PERFORMANCE_THRESHOLDS,
  TREND_THRESHOLDS,
  MISSED_EXAM_RATIO_THRESHOLD,
  RECOMMENDATION_THRESHOLDS,
} from '../constants/performance.constants';
import { PerformanceLevel, TrendStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnlineExamSubmissionInput {
  submissionStatus: string;
  totalScore: number | string | null; // Prisma Decimal often arrives as string
  exam?: { totalMarks: number } | null;
}

interface ManualExamMarkInput {
  isAbsent: boolean;
  marksObtained: any; // Prisma Decimal often arrives as an object/string
  manualExam?: { totalMarks: number } | null;
}

export interface ExamMetrics {
  average: number | null;
  validCount: number;
  missedCount: number;
  totalAttemptedOrMissed: number;
}

// ---------------------------------------------------------------------------
// Metric calculation
// ---------------------------------------------------------------------------

function calculateOnlineExamMetrics(submissions: OnlineExamSubmissionInput[]): ExamMetrics {
  let totalNormalizedScore = 0;
  let validCount = 0;
  let missedCount = 0;

  for (const sub of submissions) {
    if (sub.submissionStatus === 'MISSED') {
      missedCount++;
      validCount++;
      // A missed exam is counted as 0 marks
      continue;
    }
    if (sub.totalScore == null) {
      // Not yet graded — excluded from both valid and missed counts.
      continue;
    }
    const totalMarks = sub.exam?.totalMarks;
    if (!totalMarks || totalMarks <= 0) {
      // Data integrity issue: score present but no valid totalMarks to
      // normalize against. Skip rather than silently corrupting the
      // average with Infinity/NaN.
      console.warn('[performance] Skipping submission with missing/invalid exam.totalMarks', sub);
      continue;
    }
    totalNormalizedScore += (Number(sub.totalScore) / totalMarks) * 100;
    validCount++;
  }

  return {
    average: validCount > 0 ? totalNormalizedScore / validCount : null,
    validCount,
    missedCount,
    totalAttemptedOrMissed: validCount,
  };
}

function calculateManualExamMetrics(marks: ManualExamMarkInput[]): ExamMetrics {
  let totalNormalizedScore = 0;
  let validCount = 0;
  let missedCount = 0;

  for (const mark of marks) {
    if (mark.isAbsent) {
      missedCount++;
      validCount++;
      // An absent exam is counted as 0 marks
      continue;
    }
    if (mark.marksObtained == null) {
      continue;
    }
    const totalMarks = mark.manualExam?.totalMarks;
    if (!totalMarks || totalMarks <= 0) {
      console.warn('[performance] Skipping manual mark with missing/invalid manualExam.totalMarks', mark);
      continue;
    }
    totalNormalizedScore += (Number(mark.marksObtained) / totalMarks) * 100;
    validCount++;
  }

  return {
    average: validCount > 0 ? totalNormalizedScore / validCount : null,
    validCount,
    missedCount,
    totalAttemptedOrMissed: validCount,
  };
}

// ---------------------------------------------------------------------------
// Weight redistribution
// ---------------------------------------------------------------------------

function redistributeWeights(metrics: {
  mcq: ExamMetrics;
  essay: ExamMetrics;
  manual: ExamMetrics;
}) {
  const weights: Record<keyof typeof DEFAULT_WEIGHTS, number> = { ...DEFAULT_WEIGHTS };
  let weightSum = 1;

  if (metrics.mcq.validCount === 0) {
    weightSum -= weights.MCQ;
    weights.MCQ = 0;
  }
  if (metrics.essay.validCount === 0) {
    weightSum -= weights.ESSAY;
    weights.ESSAY = 0;
  }
  if (metrics.manual.validCount === 0) {
    weightSum -= weights.MANUAL_EXAM;
    weights.MANUAL_EXAM = 0;
  }

  // weightSum can never reach 0 here because ATTENDANCE's weight is never
  // removed, so this division is always safe.
  if (weightSum > 0 && weightSum < 1) {
    weights.ATTENDANCE /= weightSum;
    weights.MCQ /= weightSum;
    weights.ESSAY /= weightSum;
    weights.MANUAL_EXAM /= weightSum;
  }

  return weights;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function calculatePerformanceResult(data: {
  attendanceScore: number;
  mcqExams: OnlineExamSubmissionInput[];
  essayExams: OnlineExamSubmissionInput[];
  manualExams: ManualExamMarkInput[];
  previousFinalScore?: number | null;
}) {
  const { mcqExams, essayExams, manualExams, previousFinalScore } = data;
  const attendanceScore = Math.min(100, Math.max(0, data.attendanceScore)); // defensive clamp

  const mcqMetrics = calculateOnlineExamMetrics(mcqExams);
  const essayMetrics = calculateOnlineExamMetrics(essayExams);
  const manualMetrics = calculateManualExamMetrics(manualExams);

  // --- Minimum Data Requirement ---
  const isProvisional =
    mcqMetrics.validCount === 0 &&
    essayMetrics.validCount === 0 &&
    manualMetrics.validCount === 0;

  const weights = redistributeWeights({ mcq: mcqMetrics, essay: essayMetrics, manual: manualMetrics });

  const finalScore =
    attendanceScore * weights.ATTENDANCE +
    (mcqMetrics.average ?? 0) * weights.MCQ +
    (essayMetrics.average ?? 0) * weights.ESSAY +
    (manualMetrics.average ?? 0) * weights.MANUAL_EXAM;

  // --- Categorization ---
  let performanceLevel: PerformanceLevel = PerformanceLevel.AT_RISK;
  if (isProvisional) {
    performanceLevel = PerformanceLevel.AVERAGE;
  } else if (finalScore >= PERFORMANCE_THRESHOLDS.EXCELLENT) {
    performanceLevel = PerformanceLevel.EXCELLENT;
  } else if (finalScore >= PERFORMANCE_THRESHOLDS.VERY_GOOD) {
    performanceLevel = PerformanceLevel.VERY_GOOD;
  } else if (finalScore >= PERFORMANCE_THRESHOLDS.GOOD) {
    performanceLevel = PerformanceLevel.GOOD;
  } else if (finalScore >= PERFORMANCE_THRESHOLDS.AVERAGE) {
    performanceLevel = PerformanceLevel.AVERAGE;
  } else if (finalScore >= PERFORMANCE_THRESHOLDS.NEEDS_IMPROVEMENT) {
    performanceLevel = PerformanceLevel.NEEDS_IMPROVEMENT;
  }

  // --- Trend ---
  let trendStatus: TrendStatus = TrendStatus.STABLE;
  if (previousFinalScore != null) {
    const diff = finalScore - previousFinalScore;
    if (diff >= TREND_THRESHOLDS.IMPROVING_MIN) {
      trendStatus = TrendStatus.IMPROVING;
    } else if (diff <= TREND_THRESHOLDS.DECLINING_MAX) {
      trendStatus = TrendStatus.DECLINING;
    }
  }

  // --- Recommendations ---
  const recommendations: string[] = [];

  if (!isProvisional && attendanceScore < RECOMMENDATION_THRESHOLDS.LOW_ATTENDANCE) {
    recommendations.push('Improve attendance');
  }
  if (mcqMetrics.average !== null && mcqMetrics.average < RECOMMENDATION_THRESHOLDS.WEAK_SUBJECT_SCORE) {
    recommendations.push('Practice more MCQ questions');
  }
  if (essayMetrics.average !== null && essayMetrics.average < RECOMMENDATION_THRESHOLDS.WEAK_SUBJECT_SCORE) {
    recommendations.push('Improve essay writing skills');
  }
  if (manualMetrics.average !== null && manualMetrics.average < RECOMMENDATION_THRESHOLDS.WEAK_SUBJECT_SCORE) {
    recommendations.push('Focus on manual/physical exam preparation');
  }

  // Missed-exam ratios are checked PER CATEGORY, not merged. Merging MCQ and
  // Essay (as in the original version) can hide a category-specific problem:
  // e.g. a student who attends every MCQ but misses most Essay exams would
  // produce a healthy combined ratio and never get flagged.
  if (
    mcqMetrics.totalAttemptedOrMissed > 0 &&
    mcqMetrics.missedCount / mcqMetrics.totalAttemptedOrMissed >= MISSED_EXAM_RATIO_THRESHOLD
  ) {
    recommendations.push('Frequently absent for MCQ exams — please follow up');
  }
  if (
    essayMetrics.totalAttemptedOrMissed > 0 &&
    essayMetrics.missedCount / essayMetrics.totalAttemptedOrMissed >= MISSED_EXAM_RATIO_THRESHOLD
  ) {
    recommendations.push('Frequently absent for Essay exams — please follow up');
  }
  if (
    manualMetrics.totalAttemptedOrMissed > 0 &&
    manualMetrics.missedCount / manualMetrics.totalAttemptedOrMissed >= MISSED_EXAM_RATIO_THRESHOLD
  ) {
    recommendations.push('Frequently absent for physical exams — please follow up');
  }
  if (trendStatus === TrendStatus.DECLINING) {
    recommendations.push('Attend revision classes (declining trend detected)');
  }

  if (isProvisional) {
    recommendations.push('More assessment data is required for an accurate prediction');
  }

  return {
    attendanceScore,
    mcqMetrics,
    essayMetrics,
    manualMetrics,
    weights,
    finalScore,
    performanceLevel,
    trendStatus,
    recommendations,
    isProvisional,
    totalMissedOnline: mcqMetrics.missedCount + essayMetrics.missedCount,
    totalMissedManual: manualMetrics.missedCount,
  };
}
