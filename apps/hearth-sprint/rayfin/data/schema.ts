import { AppMarker } from './AppMarker.js';
import { Card } from './Card.js';
import { Confirm } from './Confirm.js';
import { Learner } from './Learner.js';
import { Person } from './Person.js';
import { Recall } from './Recall.js';
import { Sprint } from './Sprint.js';
import { Study } from './Study.js';
import { Topic } from './Topic.js';

export type AppSchema = {
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

export const schema = [Person, AppMarker, Sprint, Topic, Learner, Card, Study, Recall, Confirm];
