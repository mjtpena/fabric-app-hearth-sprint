import type { EntityDefs } from '@x10/shared/data';
import { AppMarkerDef, PersonDef, type AppMarker, type Person } from '@x10/shared/identity';

export type StudyKind = 'read' | 'watch' | 'build' | 'teach';

export const limits = {
  sprintName: { min: 3, max: 60 },
  topicTitle: { min: 3, max: 60 },
  personName: { max: 100 },
  team: { max: 40 },
  prompt: { min: 3, max: 200 },
  answer: { min: 1, max: 200 },
  note: { max: 200 },
} as const;

export interface Sprint {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  hostSub: string;
}

export interface Topic {
  id: string;
  sprintId: string;
  hostSub: string;
  title: string;
  weight: number;
}

export interface Learner {
  id: string;
  sprintId: string;
  personSub: string;
  personName: string;
  team: string;
}

export interface Card {
  id: string;
  topicId: string;
  sprintId: string;
  authorSub: string;
  authorName: string;
  prompt: string;
  answer: string;
}

export interface Study {
  id: string;
  sprintId: string;
  topicId: string;
  learnerSub: string;
  day: string;
  minutes: number;
  kind: StudyKind;
  note: string | null;
}

export interface Recall {
  id: string;
  sprintId: string;
  topicId: string;
  learnerSub: string;
  takenAt: string;
  items: number;
  correct: number;
}

export interface Confirm {
  id: string;
  recallId: string;
  sprintId: string;
  confirmerSub: string;
  agrees: boolean;
  at: string;
}

export type Schema = {
  Person: Person;
  AppMarker: AppMarker;
  Sprint: Sprint;
  Topic: Topic;
  Learner: Learner;
  Card: Card;
  Study: Study;
  Recall: Recall;
  Confirm: Confirm;
};

export const defs: EntityDefs<Schema> = {
  Person: PersonDef,
  AppMarker: AppMarkerDef,
  Sprint: {
    name: 'Sprint',
    fields: { id: 'uuid', name: 'text', startsOn: 'date', endsOn: 'date', hostSub: 'text' },
  },
  Topic: {
    name: 'Topic',
    fields: { id: 'uuid', sprintId: 'uuid', hostSub: 'text', title: 'text', weight: 'decimal' },
  },
  Learner: {
    name: 'Learner',
    fields: { id: 'uuid', sprintId: 'uuid', personSub: 'text', personName: 'text', team: 'text' },
  },
  Card: {
    name: 'Card',
    fields: {
      id: 'uuid',
      topicId: 'uuid',
      sprintId: 'uuid',
      authorSub: 'text',
      authorName: 'text',
      prompt: 'text',
      answer: 'text',
    },
  },
  Study: {
    name: 'Study',
    fields: {
      id: 'uuid',
      sprintId: 'uuid',
      topicId: 'uuid',
      learnerSub: 'text',
      day: 'date',
      minutes: 'int',
      kind: 'set',
      note: 'text',
    },
  },
  Recall: {
    name: 'Recall',
    fields: {
      id: 'uuid',
      sprintId: 'uuid',
      topicId: 'uuid',
      learnerSub: 'text',
      takenAt: 'date',
      items: 'int',
      correct: 'int',
    },
  },
  Confirm: {
    name: 'Confirm',
    fields: {
      id: 'uuid',
      recallId: 'uuid',
      sprintId: 'uuid',
      confirmerSub: 'text',
      agrees: 'bool',
      at: 'date',
    },
  },
};
