import { PermissionError, RuleError, type DataStore } from '@x10/shared/data';
import type { Person } from '@x10/shared/identity';

import type { Card, Confirm, Learner, Recall, Schema, Sprint, Study, StudyKind, Topic } from '../model';
import { limits } from '../model';
import { CONFIG } from './config';
import { confirmsByPersonOnDay, computeSprintSnapshot, type SprintSnapshot } from './rules';

export interface SprintBundle {
  sprint: Sprint | null;
  topics: Topic[];
  learners: Learner[];
  cards: Card[];
  studies: Study[];
  recalls: Recall[];
  confirms: Confirm[];
  snapshot: SprintSnapshot;
  nowIso: string;
}

export async function loadSprintBundle(
  store: DataStore<Schema>,
  nowIso: string = new Date().toISOString(),
): Promise<SprintBundle> {
  const [sprints, topics, learners, cards, studies, recalls, confirms] = await Promise.all([
    store.repo('Sprint').list(),
    store.repo('Topic').list(),
    store.repo('Learner').list(),
    store.repo('Card').list(),
    store.repo('Study').list(),
    store.repo('Recall').list(),
    store.repo('Confirm').list(),
  ]);

  const sprint = sprints[0] ?? null;
  const snapshot = computeSprintSnapshot(topics, learners, studies, recalls, confirms, nowIso);

  return {
    sprint,
    topics,
    learners,
    cards,
    studies,
    recalls,
    confirms,
    snapshot,
    nowIso,
  };
}

export interface LogStudyInput {
  sprintId: string;
  topicId: string;
  day: string;
  minutes: number;
  kind: StudyKind;
  note?: string;
}

export async function logStudySession(
  store: DataStore<Schema>,
  me: Person,
  input: LogStudyInput,
): Promise<Study> {
  if (!input.topicId) throw new RuleError('Select a topic for your study session.');
  if (!Number.isFinite(input.minutes) || input.minutes < 1 || input.minutes > 600) {
    throw new RuleError('Minutes must be between 1 and 600.');
  }
  const note = input.note?.trim() ?? '';
  if (note.length > limits.note.max) {
    throw new RuleError(`Note must be at most ${limits.note.max} characters.`);
  }

  return store.repo('Study').create({
    sprintId: input.sprintId,
    topicId: input.topicId,
    learnerSub: me.sub,
    day: input.day,
    minutes: Math.round(input.minutes),
    kind: input.kind,
    note: note || null,
  });
}

export interface SubmitRecallInput {
  sprintId: string;
  topicId: string;
  items: number;
  correct: number;
  takenAt?: string;
}

export async function submitRecallCheck(
  store: DataStore<Schema>,
  me: Person,
  input: SubmitRecallInput,
): Promise<Recall> {
  if (!input.topicId) throw new RuleError('Select a topic for the recall check.');
  if (input.items < 1 || input.items > 20) {
    throw new RuleError('Recall must include between 1 and 20 items.');
  }
  if (input.correct < 0 || input.correct > input.items) {
    throw new RuleError('Correct count cannot exceed total items.');
  }

  return store.repo('Recall').create({
    sprintId: input.sprintId,
    topicId: input.topicId,
    learnerSub: me.sub,
    takenAt: input.takenAt ?? new Date().toISOString(),
    items: input.items,
    correct: input.correct,
  });
}

export async function confirmRecall(
  store: DataStore<Schema>,
  me: Person,
  recall: Recall,
  agrees: boolean,
  nowIso: string = new Date().toISOString(),
): Promise<Confirm> {
  if (recall.learnerSub === me.sub) {
    throw new RuleError('You cannot confirm your own recall check; ask a teammate.');
  }
  const existing = await store.repo('Confirm').list();
  if (existing.some((c) => c.recallId === recall.id && c.confirmerSub === me.sub)) {
    throw new RuleError('You have already reviewed this recall check.');
  }
  const todayCount = confirmsByPersonOnDay(existing, me.sub, nowIso);
  if (todayCount >= CONFIG.maxConfirmsPerDay) {
    throw new RuleError(
      `Daily confirmation limit reached (${CONFIG.maxConfirmsPerDay} per day).`,
    );
  }

  return store.repo('Confirm').create({
    recallId: recall.id,
    sprintId: recall.sprintId,
    confirmerSub: me.sub,
    agrees,
    at: nowIso,
  });
}

export interface SaveCardInput {
  id?: string;
  sprintId: string;
  topicId: string;
  prompt: string;
  answer: string;
}

export async function saveCard(
  store: DataStore<Schema>,
  me: Person,
  input: SaveCardInput,
): Promise<Card> {
  const prompt = input.prompt.trim();
  const answer = input.answer.trim();
  if (prompt.length < limits.prompt.min || prompt.length > limits.prompt.max) {
    throw new RuleError(
      `Prompt must be ${limits.prompt.min}–${limits.prompt.max} characters.`,
    );
  }
  if (answer.length < limits.answer.min || answer.length > limits.answer.max) {
    throw new RuleError(
      `Answer must be ${limits.answer.min}–${limits.answer.max} characters.`,
    );
  }

  if (input.id) {
    const existing = await store.repo('Card').get(input.id);
    if (existing && existing.authorSub !== me.sub && !me.isAdmin) {
      throw new PermissionError('Only the card author or sprint host can edit this card.');
    }
    return store.repo('Card').update(input.id, {
      topicId: input.topicId,
      prompt,
      answer,
    });
  }

  return store.repo('Card').create({
    sprintId: input.sprintId,
    topicId: input.topicId,
    authorSub: me.sub,
    authorName: me.displayName,
    prompt,
    answer,
  });
}

export async function deleteCard(
  store: DataStore<Schema>,
  me: Person,
  card: Card,
): Promise<void> {
  if (card.authorSub !== me.sub && !me.isAdmin) {
    throw new PermissionError('Only the card author or sprint host can delete this card.');
  }
  await store.repo('Card').remove(card.id);
}
