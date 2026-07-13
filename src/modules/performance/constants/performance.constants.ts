/**
 * Default weight distribution for the Performance Prediction algorithm.
 * Mirrors the example weights from the design document (Section 5):
 * Attendance 20%, MCQ 30%, Essay 30%, Manual Exams 20%.
 *
 * Kept as named constants (not hardcoded inline) so the weighting stays
 * configurable per the design document's requirement.
 */
export const DEFAULT_WEIGHTS = {
  ATTENDANCE: 0.10,
  MCQ: 0.20,
  ESSAY: 0.30,
  MANUAL_EXAM: 0.40,
} as const;

export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 90,
  VERY_GOOD: 80,
  GOOD: 70,
  AVERAGE: 55,
  NEEDS_IMPROVEMENT: 40,
  // AT_RISK is anything below 40
} as const;

export const TREND_THRESHOLDS = {
  IMPROVING_MIN: 5,
  DECLINING_MAX: -5,
} as const;

/** Per-category missed/absent exam ratio that triggers a follow-up recommendation. */
export const MISSED_EXAM_RATIO_THRESHOLD = 0.5; // 50%

/**
 * Thresholds that drive recommendation text — deliberately separate from
 * PERFORMANCE_THRESHOLDS. "Score is weak enough to flag with advice" is a
 * different concept from "score is low enough to change category", and they
 * may need to be tuned independently later.
 */
export const RECOMMENDATION_THRESHOLDS = {
  LOW_ATTENDANCE: 70,
  WEAK_SUBJECT_SCORE: 55,
} as const;
