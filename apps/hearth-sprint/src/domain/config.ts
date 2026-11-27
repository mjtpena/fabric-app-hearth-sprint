import type { StudyKind } from '../model';

/**
 * Pure domain thresholds for Hearth Sprint.
 * Shown on the About page and used by all forgetting-curve and scoring calculations.
 */
export const CONFIG = {
  /** Initial stability S (days) after a learner's first valid study session on a topic. */
  initialStabilityDays: 2,
  /** Stability floor (days) after a failed recall. */
  minStabilityDays: 1,
  /** Multiplier on S when a confirmed recall scores >= 70% and < 90%. */
  passRecallMultiplier: 2.0,
  /** Multiplier on S when a confirmed recall scores >= 90%. */
  highRecallMultiplier: 2.5,
  /** Accuracy threshold for a passing recall. */
  passRecallThreshold: 0.7,
  /** Accuracy threshold for a high-mastery recall. */
  highRecallThreshold: 0.9,
  /** Multiplier on S when a confirmed recall scores < 70%. */
  failRecallMultiplier: 0.5,
  /** Multiplier on S when a learner logs a valid study session on a new calendar day. */
  newDayStudyMultiplier: 1.2,
  /** Retrievability threshold at which the next recall becomes due. */
  recallDueThreshold: 0.7,
  /** Retrievability below which a log is considered faded to grey ash. */
  ashThreshold: 0.35,
  /** Study sessions strictly under this many minutes score 0. */
  minSessionMinutes: 10,
  /** Maximum countable raw study minutes per learner per calendar day. */
  maxMinutesPerDay: 180,
  /** Maximum effective hours per learner per topic. */
  maxEffectiveHoursPerTopic: 3,
  /** Kind weights for converting raw study minutes to effective hours. */
  kindWeights: {
    read: 0.6,
    watch: 0.6,
    build: 1.0,
    teach: 1.4,
  } as Record<StudyKind, number>,
  /** Maximum recalls one teammate may confirm in a single calendar day. */
  maxConfirmsPerDay: 5,
  /** Number of cards drawn per recall check. */
  cardsPerRecall: 5,
  /** Sprint length in days. */
  sprintDays: 21,
} as const;

export const KIND_LABELS: Record<StudyKind, string> = {
  read: 'Read',
  watch: 'Watch',
  build: 'Build',
  teach: 'Teach',
};
