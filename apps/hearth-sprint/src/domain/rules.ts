import type { Card, Confirm, Learner, Recall, Study, StudyKind, Topic } from '../model';
import { CONFIG } from './config';

export const MS_PER_DAY = 86_400_000;

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Deterministic 32-bit FNV-1a hash for seeded PRNGs. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32 deterministic PRNG in [0, 1). */
export function createPrng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rule 1: Retrievability R = exp(-daysSince / S). */
export function retrievability(daysSince: number, stabilityDays: number): number {
  if (stabilityDays <= 0) return 0;
  const d = Math.max(0, daysSince);
  return Math.exp(-d / stabilityDays);
}

/** Rule 4: Next recall due date when R falls to 0.7: last + (-ln 0.7) * S days. */
export function nextRecallDueAt(lastActivityIso: string, stabilityDays: number): string {
  const daysUntilDue = -Math.log(CONFIG.recallDueThreshold) * stabilityDays;
  const ms = Date.parse(lastActivityIso) + daysUntilDue * MS_PER_DAY;
  return new Date(ms).toISOString();
}

export function isRecallConfirmed(recall: Recall, confirms: Confirm[]): boolean {
  return confirms.some(
    (c) => c.recallId === recall.id && c.agrees && c.confirmerSub !== recall.learnerSub,
  );
}

export function getRecallStatus(
  recall: Recall,
  confirms: Confirm[],
): 'confirmed' | 'disputed' | 'pending' {
  const valid = confirms.filter(
    (c) => c.recallId === recall.id && c.confirmerSub !== recall.learnerSub,
  );
  if (valid.some((c) => c.agrees)) return 'confirmed';
  if (valid.some((c) => !c.agrees)) return 'disputed';
  return 'pending';
}

export interface EffectiveHoursResult {
  byTopic: Map<string, number>;
  countedMinutesByDay: Map<string, number>;
  rawMinutesByDay: Map<string, number>;
  kindMinutesByTopic: Map<string, Record<StudyKind, number>>;
}

/**
 * Rule 2: Effective hours for a single learner.
 * - Sessions < 10 min count 0.
 * - Daily cap: 180 countable minutes per calendar day.
 * - Kind weights: read 0.6, watch 0.6, build 1.0, teach 1.4.
 * - Topic cap: 3 effective hours per topic.
 */
export function computeLearnerEffectiveHours(studies: Study[]): EffectiveHoursResult {
  const sorted = [...studies].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id));
  const countedMinutesByDay = new Map<string, number>();
  const rawMinutesByDay = new Map<string, number>();
  const rawEffectiveByTopic = new Map<string, number>();
  const kindMinutesByTopic = new Map<string, Record<StudyKind, number>>();

  for (const s of sorted) {
    const dk = dayKey(s.day);
    rawMinutesByDay.set(dk, (rawMinutesByDay.get(dk) ?? 0) + Math.max(0, s.minutes));

    if (s.minutes < CONFIG.minSessionMinutes) continue;

    const usedToday = countedMinutesByDay.get(dk) ?? 0;
    const remaining = Math.max(0, CONFIG.maxMinutesPerDay - usedToday);
    const counted = Math.min(s.minutes, remaining);
    if (counted <= 0) continue;

    countedMinutesByDay.set(dk, usedToday + counted);

    const weight = CONFIG.kindWeights[s.kind] ?? 1.0;
    const effHours = (counted / 60) * weight;
    rawEffectiveByTopic.set(s.topicId, (rawEffectiveByTopic.get(s.topicId) ?? 0) + effHours);

    const km = kindMinutesByTopic.get(s.topicId) ?? { read: 0, watch: 0, build: 0, teach: 0 };
    km[s.kind] += counted;
    kindMinutesByTopic.set(s.topicId, km);
  }

  const byTopic = new Map<string, number>();
  for (const [topicId, hrs] of rawEffectiveByTopic) {
    byTopic.set(topicId, Math.min(CONFIG.maxEffectiveHoursPerTopic, hrs));
  }

  return { byTopic, countedMinutesByDay, rawMinutesByDay, kindMinutesByTopic };
}

export interface MemoryEvent {
  at: string;
  kind: 'study' | 'pass' | 'high' | 'fail';
  stabilityAfter: number;
}

export interface MemoryState {
  hasActivity: boolean;
  stabilityDays: number;
  lastActivity: string | null;
  daysSinceLast: number;
  retrievability: number;
  nextDueAt: string | null;
  isDue: boolean;
  isAsh: boolean;
  confirmedRecalls: number;
  pendingRecalls: number;
  failedRecalls: number;
  events: MemoryEvent[];
}

/**
 * Rule 1 & Rule 4: Compute memory strength S and retrievability R for one (learner, topic).
 * Unconfirmed recalls do not change S or lastActivity.
 */
export function computeMemoryState(
  studies: Study[],
  recalls: Recall[],
  confirms: Confirm[],
  nowIso: string,
): MemoryState {
  const validStudies = studies.filter((s) => s.minutes >= CONFIG.minSessionMinutes);

  type TimelineItem =
    | { type: 'study'; at: string; id: string }
    | { type: 'recall'; at: string; id: string; accuracy: number };

  const items: TimelineItem[] = [];
  for (const s of validStudies) {
    items.push({ type: 'study', at: s.day, id: s.id });
  }

  let confirmedRecalls = 0;
  let pendingRecalls = 0;
  let failedRecalls = 0;

  for (const r of recalls) {
    const status = getRecallStatus(r, confirms);
    if (status === 'pending') {
      pendingRecalls += 1;
      continue;
    }
    if (status === 'disputed') {
      continue;
    }
    confirmedRecalls += 1;
    const accuracy = r.items > 0 ? r.correct / r.items : 0;
    if (accuracy < CONFIG.passRecallThreshold) failedRecalls += 1;
    items.push({ type: 'recall', at: r.takenAt, id: r.id, accuracy });
  }

  if (items.length === 0) {
    return {
      hasActivity: false,
      stabilityDays: 0,
      lastActivity: null,
      daysSinceLast: Infinity,
      retrievability: 0,
      nextDueAt: null,
      isDue: false,
      isAsh: true,
      confirmedRecalls,
      pendingRecalls,
      failedRecalls,
      events: [],
    };
  }

  items.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));

  let stability = 0;
  let lastActivity: string | null = null;
  let lastStudyDay: string | null = null;
  const events: MemoryEvent[] = [];

  for (const ev of items) {
    if (ev.type === 'study') {
      const dk = dayKey(ev.at);
      if (stability === 0) {
        stability = CONFIG.initialStabilityDays;
        lastStudyDay = dk;
      } else if (lastStudyDay !== dk) {
        stability = stability * CONFIG.newDayStudyMultiplier;
        lastStudyDay = dk;
      }
      lastActivity = ev.at;
      events.push({ at: ev.at, kind: 'study', stabilityAfter: stability });
    } else {
      if (stability === 0) stability = CONFIG.initialStabilityDays;
      let kind: MemoryEvent['kind'];
      if (ev.accuracy >= CONFIG.highRecallThreshold) {
        stability = stability * CONFIG.highRecallMultiplier;
        kind = 'high';
      } else if (ev.accuracy >= CONFIG.passRecallThreshold) {
        stability = stability * CONFIG.passRecallMultiplier;
        kind = 'pass';
      } else {
        stability = Math.max(CONFIG.minStabilityDays, stability * CONFIG.failRecallMultiplier);
        kind = 'fail';
      }
      lastActivity = ev.at;
      events.push({ at: ev.at, kind, stabilityAfter: stability });
    }
  }

  const nowMs = Date.parse(nowIso);
  const lastMs = Date.parse(lastActivity!);
  const daysSinceLast = Math.max(0, (nowMs - lastMs) / MS_PER_DAY);
  const r = retrievability(daysSinceLast, stability);
  const nextDueAt = nextRecallDueAt(lastActivity!, stability);

  return {
    hasActivity: true,
    stabilityDays: stability,
    lastActivity,
    daysSinceLast,
    retrievability: r,
    nextDueAt,
    isDue: r < CONFIG.recallDueThreshold,
    isAsh: r < CONFIG.ashThreshold,
    confirmedRecalls,
    pendingRecalls,
    failedRecalls,
    events,
  };
}

/** Rule 5: Draw up to 5 deterministic random cards from a topic, seeded by learner and day. */
export function drawRecallCards(
  cards: Card[],
  topicId: string,
  learnerSub: string,
  dayIso: string,
  count: number = CONFIG.cardsPerRecall,
): Card[] {
  const pool = cards
    .filter((c) => c.topicId === topicId)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length <= count) return pool;

  const rng = createPrng(hashString(`${learnerSub}|${topicId}|${dayKey(dayIso)}`));
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export interface LogSummary {
  key: string;
  learnerSub: string;
  learnerName: string;
  team: string;
  topicId: string;
  topicTitle: string;
  effectiveHours: number;
  retainedHours: number;
  memory: MemoryState;
  kindMinutes: Record<StudyKind, number>;
}

export interface TopicSummary {
  topic: Topic;
  meanR: number;
  totalEffectiveHours: number;
  totalRetainedHours: number;
  activeLearners: number;
  dueCount: number;
  ashCount: number;
  nextDueAt: string | null;
  kindMinutes: Record<StudyKind, number>;
}

export interface LearnerSummary {
  learner: Learner;
  effectiveHours: number;
  retainedHours: number;
  meanR: number;
  minutesToday: number;
  rawMinutesToday: number;
  dueTopics: number;
  logs: LogSummary[];
}

export interface TeamSummary {
  team: string;
  memberCount: number;
  totalRetainedHours: number;
  meanRetainedHours: number;
  meanR: number;
  rank: number;
}

export interface SprintSnapshot {
  logs: LogSummary[];
  topics: TopicSummary[];
  learners: LearnerSummary[];
  teams: TeamSummary[];
  pendingConfirms: Array<{
    recall: Recall;
    learnerName: string;
    team: string;
    topicTitle: string;
    accuracy: number;
  }>;
  totalRetainedHours: number;
  meanTeamScore: number;
}

/** Rule 3: Compute full sprint snapshot (logs, topics, learners, and size-fair team scores). */
export function computeSprintSnapshot(
  topics: Topic[],
  learners: Learner[],
  studies: Study[],
  recalls: Recall[],
  confirms: Confirm[],
  nowIso: string,
): SprintSnapshot {
  const todayKey = dayKey(nowIso);
  const topicById = new Map(topics.map((t) => [t.id, t]));
  const learnerBySub = new Map(learners.map((l) => [l.personSub, l]));

  const studiesByLearner = new Map<string, Study[]>();
  for (const s of studies) {
    const arr = studiesByLearner.get(s.learnerSub) ?? [];
    arr.push(s);
    studiesByLearner.set(s.learnerSub, arr);
  }

  const recallsByPair = new Map<string, Recall[]>();
  for (const r of recalls) {
    const key = `${r.learnerSub}::${r.topicId}`;
    const arr = recallsByPair.get(key) ?? [];
    arr.push(r);
    recallsByPair.set(key, arr);
  }

  const logs: LogSummary[] = [];
  const learnerSummaries: LearnerSummary[] = [];

  for (const learner of learners) {
    const lStudies = studiesByLearner.get(learner.personSub) ?? [];
    const eff = computeLearnerEffectiveHours(lStudies);
    const lLogs: LogSummary[] = [];
    let lEffective = 0;
    let lRetained = 0;
    let rSum = 0;
    let rCount = 0;
    let dueTopics = 0;

    for (const topic of topics) {
      const pairKey = `${learner.personSub}::${topic.id}`;
      const pairStudies = lStudies.filter((s) => s.topicId === topic.id);
      const pairRecalls = recallsByPair.get(pairKey) ?? [];
      const memory = computeMemoryState(pairStudies, pairRecalls, confirms, nowIso);
      const effectiveHours = eff.byTopic.get(topic.id) ?? 0;
      const retainedHours = effectiveHours * memory.retrievability;
      const kindMinutes = eff.kindMinutesByTopic.get(topic.id) ?? {
        read: 0,
        watch: 0,
        build: 0,
        teach: 0,
      };

      const log: LogSummary = {
        key: pairKey,
        learnerSub: learner.personSub,
        learnerName: learner.personName,
        team: learner.team,
        topicId: topic.id,
        topicTitle: topic.title,
        effectiveHours,
        retainedHours,
        memory,
        kindMinutes,
      };
      lLogs.push(log);
      logs.push(log);

      lEffective += effectiveHours;
      lRetained += retainedHours;
      if (memory.hasActivity) {
        rSum += memory.retrievability;
        rCount += 1;
        if (memory.isDue) dueTopics += 1;
      }
    }

    learnerSummaries.push({
      learner,
      effectiveHours: lEffective,
      retainedHours: lRetained,
      meanR: rCount > 0 ? rSum / rCount : 0,
      minutesToday: eff.countedMinutesByDay.get(todayKey) ?? 0,
      rawMinutesToday: eff.rawMinutesByDay.get(todayKey) ?? 0,
      dueTopics,
      logs: lLogs,
    });
  }

  const topicSummaries: TopicSummary[] = topics.map((topic) => {
    const tLogs = logs.filter((l) => l.topicId === topic.id);
    const active = tLogs.filter((l) => l.memory.hasActivity);
    const meanR =
      active.length > 0
        ? active.reduce((acc, l) => acc + l.memory.retrievability, 0) / active.length
        : 0;
    const totalEffectiveHours = tLogs.reduce((acc, l) => acc + l.effectiveHours, 0);
    const totalRetainedHours = tLogs.reduce((acc, l) => acc + l.retainedHours, 0);
    const dueCount = active.filter((l) => l.memory.isDue).length;
    const ashCount = active.filter((l) => l.memory.isAsh).length;
    const dueDates = active
      .map((l) => l.memory.nextDueAt)
      .filter((d): d is string => d !== null)
      .sort();
    const kindMinutes: Record<StudyKind, number> = { read: 0, watch: 0, build: 0, teach: 0 };
    for (const l of tLogs) {
      kindMinutes.read += l.kindMinutes.read;
      kindMinutes.watch += l.kindMinutes.watch;
      kindMinutes.build += l.kindMinutes.build;
      kindMinutes.teach += l.kindMinutes.teach;
    }
    return {
      topic,
      meanR,
      totalEffectiveHours,
      totalRetainedHours,
      activeLearners: active.length,
      dueCount,
      ashCount,
      nextDueAt: dueDates[0] ?? null,
      kindMinutes,
    };
  });

  const teamGroups = new Map<string, LearnerSummary[]>();
  for (const ls of learnerSummaries) {
    const arr = teamGroups.get(ls.learner.team) ?? [];
    arr.push(ls);
    teamGroups.set(ls.learner.team, arr);
  }

  const teamsUnsorted: Omit<TeamSummary, 'rank'>[] = [];
  for (const [team, members] of teamGroups) {
    const totalRetainedHours = members.reduce((acc, m) => acc + m.retainedHours, 0);
    const meanRetainedHours = members.length > 0 ? totalRetainedHours / members.length : 0;
    const meanR =
      members.length > 0 ? members.reduce((acc, m) => acc + m.meanR, 0) / members.length : 0;
    teamsUnsorted.push({
      team,
      memberCount: members.length,
      totalRetainedHours,
      meanRetainedHours,
      meanR,
    });
  }

  teamsUnsorted.sort(
    (a, b) => b.meanRetainedHours - a.meanRetainedHours || a.team.localeCompare(b.team),
  );

  // Assign competition ranks (ties share rank)
  const teams: TeamSummary[] = [];
  for (let i = 0; i < teamsUnsorted.length; i++) {
    const prev = teams[i - 1];
    const curr = teamsUnsorted[i];
    const isTie = prev && Math.abs(prev.meanRetainedHours - curr.meanRetainedHours) < 1e-6;
    teams.push({
      ...curr,
      rank: isTie ? prev.rank : i + 1,
    });
  }

  const pendingConfirms = recalls
    .filter((r) => getRecallStatus(r, confirms) === 'pending')
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
    .map((r) => {
      const learner = learnerBySub.get(r.learnerSub);
      const topic = topicById.get(r.topicId);
      return {
        recall: r,
        learnerName: learner?.personName ?? r.learnerSub,
        team: learner?.team ?? 'Unassigned',
        topicTitle: topic?.title ?? 'Unknown topic',
        accuracy: r.items > 0 ? r.correct / r.items : 0,
      };
    });

  const totalRetainedHours = learnerSummaries.reduce((acc, l) => acc + l.retainedHours, 0);
  const meanTeamScore =
    teams.length > 0
      ? teams.reduce((acc, t) => acc + t.meanRetainedHours, 0) / teams.length
      : 0;

  return {
    logs,
    topics: topicSummaries,
    learners: learnerSummaries,
    teams,
    pendingConfirms,
    totalRetainedHours,
    meanTeamScore,
  };
}

export function confirmsByPersonOnDay(
  confirms: Confirm[],
  confirmerSub: string,
  dayIso: string,
): number {
  const dk = dayKey(dayIso);
  return confirms.filter((c) => c.confirmerSub === confirmerSub && dayKey(c.at) === dk).length;
}
