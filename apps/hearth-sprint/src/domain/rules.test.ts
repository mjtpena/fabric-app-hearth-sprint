import { describe, expect, it } from 'vitest';

import type { Card, Confirm, Learner, Recall, Study, Topic } from '../model';
import { CONFIG } from './config';
import {
  computeLearnerEffectiveHours,
  computeMemoryState,
  computeSprintSnapshot,
  confirmsByPersonOnDay,
  drawRecallCards,
  nextRecallDueAt,
  retrievability,
} from './rules';

const NOW = '2026-12-12T12:00:00.000Z';

function daysAgo(n: number): string {
  return new Date(Date.parse(NOW) - n * 86_400_000).toISOString();
}

describe('Hearth Sprint pure rules', () => {
  it('AC1: R equals exp(-t/S) and a confirmed 92% recall multiplies S by 2.5', () => {
    const studies: Study[] = [
      {
        id: 's1',
        sprintId: 'sp1',
        topicId: 't1',
        learnerSub: 'u1',
        day: daysAgo(4),
        minutes: 60,
        kind: 'build',
        note: null,
      },
    ];

    // Before recall: S = 2, t = 4 => R = exp(-4/2)
    const before = computeMemoryState(studies, [], [], NOW);
    expect(before.stabilityDays).toBe(CONFIG.initialStabilityDays);
    expect(before.retrievability).toBeCloseTo(Math.exp(-4 / 2), 6);

    // Add a confirmed 92% recall (23/25) taken 1 day ago
    const recall: Recall = {
      id: 'r1',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: daysAgo(1),
      items: 25,
      correct: 23, // 92%
    };
    const confirm: Confirm = {
      id: 'c1',
      recallId: 'r1',
      sprintId: 'sp1',
      confirmerSub: 'u2',
      agrees: true,
      at: daysAgo(1),
    };

    const after = computeMemoryState(studies, [recall], [confirm], NOW);
    expect(after.stabilityDays).toBeCloseTo(2 * 2.5, 6); // 5.0 days
    expect(after.retrievability).toBeCloseTo(Math.exp(-1 / 5), 6);
  });

  it('Rule 1: 70-89% confirmed recall multiplies S by 2.0; failed recall halves S with floor 1 day', () => {
    const studies: Study[] = [
      {
        id: 's1',
        sprintId: 'sp1',
        topicId: 't1',
        learnerSub: 'u1',
        day: daysAgo(5),
        minutes: 45,
        kind: 'read',
        note: null,
      },
    ];
    const passRecall: Recall = {
      id: 'r-pass',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: daysAgo(3),
      items: 5,
      correct: 4, // 80%
    };
    const failRecall: Recall = {
      id: 'r-fail',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: daysAgo(1),
      items: 5,
      correct: 2, // 40%
    };
    const confirms: Confirm[] = [
      { id: 'c1', recallId: 'r-pass', sprintId: 'sp1', confirmerSub: 'u2', agrees: true, at: daysAgo(3) },
      { id: 'c2', recallId: 'r-fail', sprintId: 'sp1', confirmerSub: 'u2', agrees: true, at: daysAgo(1) },
    ];

    const state = computeMemoryState(studies, [passRecall, failRecall], confirms, NOW);
    // 2 * 2.0 = 4.0, then 4.0 * 0.5 = 2.0
    expect(state.stabilityDays).toBeCloseTo(2.0, 6);

    // Repeated failures hit floor 1 day
    const failRecall2: Recall = {
      id: 'r-fail2',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: daysAgo(0.5),
      items: 5,
      correct: 1,
    };
    const failRecall3: Recall = {
      id: 'r-fail3',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: daysAgo(0.1),
      items: 5,
      correct: 1,
    };
    const confirms2: Confirm[] = [
      ...confirms,
      { id: 'c3', recallId: 'r-fail2', sprintId: 'sp1', confirmerSub: 'u2', agrees: true, at: daysAgo(0.5) },
      { id: 'c4', recallId: 'r-fail3', sprintId: 'sp1', confirmerSub: 'u2', agrees: true, at: daysAgo(0.1) },
    ];
    const floored = computeMemoryState(
      studies,
      [passRecall, failRecall, failRecall2, failRecall3],
      confirms2,
      NOW,
    );
    expect(floored.stabilityDays).toBe(1);
  });

  it('Rule 1: study on a new calendar day multiplies S by 1.2', () => {
    const studies: Study[] = [
      { id: 's1', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: daysAgo(3), minutes: 30, kind: 'build', note: null },
      { id: 's2', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: daysAgo(1), minutes: 30, kind: 'build', note: null },
    ];
    const state = computeMemoryState(studies, [], [], NOW);
    expect(state.stabilityDays).toBeCloseTo(2 * 1.2, 6);
  });

  it('AC2: an unconfirmed recall (or self-confirm) does not change retained hours', () => {
    const topics: Topic[] = [{ id: 't1', sprintId: 'sp1', hostSub: 'h', title: 'SQL', weight: 1 }];
    const learners: Learner[] = [
      { id: 'l1', sprintId: 'sp1', personSub: 'u1', personName: 'A', team: 'Ash' },
    ];
    const studies: Study[] = [
      { id: 's1', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: daysAgo(3), minutes: 60, kind: 'build', note: null },
    ];
    const base = computeSprintSnapshot(topics, learners, studies, [], [], NOW);

    const unconfirmedRecall: Recall = {
      id: 'r1',
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: 'u1',
      takenAt: NOW,
      items: 5,
      correct: 5,
    };
    const withUnconfirmed = computeSprintSnapshot(topics, learners, studies, [unconfirmedRecall], [], NOW);
    expect(withUnconfirmed.teams[0].meanRetainedHours).toBeCloseTo(base.teams[0].meanRetainedHours, 6);

    // Self-confirmation is also ignored
    const selfConfirm: Confirm = {
      id: 'c-self',
      recallId: 'r1',
      sprintId: 'sp1',
      confirmerSub: 'u1',
      agrees: true,
      at: NOW,
    };
    const withSelf = computeSprintSnapshot(topics, learners, studies, [unconfirmedRecall], [selfConfirm], NOW);
    expect(withSelf.teams[0].meanRetainedHours).toBeCloseTo(base.teams[0].meanRetainedHours, 6);
  });

  it('AC3: 8-minute session scores 0; 400 minutes in one day caps at 180 minutes; topic caps at 3 effective hours', () => {
    const shortOnly: Study[] = [
      { id: 's1', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: NOW, minutes: 8, kind: 'teach', note: null },
    ];
    expect(computeLearnerEffectiveHours(shortOnly).byTopic.get('t1') ?? 0).toBe(0);

    const marathon: Study[] = [
      { id: 's2', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: NOW, minutes: 400, kind: 'build', note: null },
    ];
    const res = computeLearnerEffectiveHours(marathon);
    expect(res.countedMinutesByDay.get('2026-12-12')).toBe(180);
    // 180 min * 1.0 = 3.0 effective hours
    expect(res.byTopic.get('t1')).toBeCloseTo(3.0, 6);

    // Teaching 180 min would be 4.2h, capped at 3.0h per topic
    const teachCap: Study[] = [
      { id: 's3', sprintId: 'sp1', topicId: 't1', learnerSub: 'u1', day: NOW, minutes: 180, kind: 'teach', note: null },
    ];
    expect(computeLearnerEffectiveHours(teachCap).byTopic.get('t1')).toBe(3);
  });

  it('AC4: two teams of different size with the same per-member retention tie', () => {
    const topics: Topic[] = [{ id: 't1', sprintId: 'sp1', hostSub: 'h', title: 'SQL', weight: 1 }];
    const learners: Learner[] = [
      { id: 'l1', sprintId: 'sp1', personSub: 'u1', personName: 'A1', team: 'Small' },
      { id: 'l2', sprintId: 'sp1', personSub: 'u2', personName: 'B1', team: 'Large' },
      { id: 'l3', sprintId: 'sp1', personSub: 'u3', personName: 'B2', team: 'Large' },
      { id: 'l4', sprintId: 'sp1', personSub: 'u4', personName: 'B3', team: 'Large' },
    ];
    const studies: Study[] = learners.map((l, idx) => ({
      id: `s-${idx}`,
      sprintId: 'sp1',
      topicId: 't1',
      learnerSub: l.personSub,
      day: daysAgo(1),
      minutes: 60,
      kind: 'build',
      note: null,
    }));

    const snap = computeSprintSnapshot(topics, learners, studies, [], [], NOW);
    expect(snap.teams).toHaveLength(2);
    expect(snap.teams[0].meanRetainedHours).toBeCloseTo(snap.teams[1].meanRetainedHours, 6);
    expect(snap.teams[0].rank).toBe(1);
    expect(snap.teams[1].rank).toBe(1);
  });

  it('Rule 4 & Rule 5: nextRecallDueAt uses -ln(0.7)*S, confirmsByPersonOnDay counts daily, drawRecallCards is deterministic', () => {
    const due = nextRecallDueAt(NOW, 4);
    const expectedDays = -Math.log(0.7) * 4;
    const actualDays = (Date.parse(due) - Date.parse(NOW)) / 86_400_000;
    expect(actualDays).toBeCloseTo(expectedDays, 6);
    expect(retrievability(expectedDays, 4)).toBeCloseTo(0.7, 6);

    const confirms: Confirm[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c-${i}`,
      recallId: `r-${i}`,
      sprintId: 'sp1',
      confirmerSub: 'u2',
      agrees: true,
      at: NOW,
    }));
    expect(confirmsByPersonOnDay(confirms, 'u2', NOW)).toBe(5);

    const cards: Card[] = Array.from({ length: 12 }, (_, i) => ({
      id: `card-${i}`,
      topicId: 't1',
      sprintId: 'sp1',
      authorSub: 'h',
      authorName: 'Host',
      prompt: `Prompt ${i}`,
      answer: `Answer ${i}`,
    }));
    const draw1 = drawRecallCards(cards, 't1', 'u1', NOW);
    const draw2 = drawRecallCards(cards, 't1', 'u1', NOW);
    expect(draw1).toHaveLength(5);
    expect(draw1.map((c) => c.id)).toEqual(draw2.map((c) => c.id));
  });
});
