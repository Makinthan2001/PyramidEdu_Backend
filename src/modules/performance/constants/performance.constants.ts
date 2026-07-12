export const DEFAULT_WEIGHTS = {
  ATTENDANCE: 0.10,
  MCQ: 0.20,
  ESSAY: 0.30,
  MANUAL_EXAM: 0.40,
};

export const PERFORMANCE_THRESHOLDS = {
  EXCELLENT: 90,
  VERY_GOOD: 80,
  GOOD: 70,
  AVERAGE: 55,
  NEEDS_IMPROVEMENT: 40,
  // AT_RISK is anything below 40
};

export const TREND_THRESHOLDS = {
  IMPROVING_MIN: 5,
  DECLINING_MAX: -5,
};

// Threshold for missing/absent exams to trigger a specific recommendation
export const MISSED_EXAM_RATIO_THRESHOLD = 0.5; // 50%
