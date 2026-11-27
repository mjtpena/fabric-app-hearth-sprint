/**
 * App configuration. No React imports here: tools/seed-fabric.mjs loads this file in Node to export seed rows.
 */
import type { Persona } from '@x10/shared/identity';
import type { AppConfig } from '@x10/shared/runtime';

import { defs, type Schema } from './model';
import { seed } from './seed';

export const personas: Persona[] = [
  { sub: 'demo-admin', name: 'Maren Solberg', email: 'maren@example.com', isAdmin: true, role: 'Host' },
  { sub: 'demo-learner', name: 'Devon Okafor', email: 'devon@example.com', isAdmin: false, role: 'Learner' },
  { sub: 'demo-buddy', name: 'Tessa Lindqvist', email: 'tessa@example.com', isAdmin: false, role: 'Learner' },
];

export const config: AppConfig<Schema> = {
  appId: 'hearth-sprint',
  title: 'Hearth Sprint',
  tagline: 'Score what you retain, not what you sit through',
  accent: 'ember',
  logoPaths: [
    'M12 3c2.8 3.2 4.5 5.8 4.5 8.8a4.5 4.5 0 1 1-9 0c0-1.9.8-3.7 2.1-5.4.3 1.4 1.1 2.2 2.1 2.4-.5-2.1-.3-4.1.3-5.8Z',
    'M5 19.5h14',
    'M7 16.8h10',
  ],
  defs,
  personas,
  seed,
  nav: [
    { to: '/', label: 'Hearth', end: true },
    { to: '/study', label: 'Study log' },
    { to: '/poker', label: 'Poker' },
    { to: '/cards', label: 'Card bank' },
    { to: '/bench', label: 'Buddy bench' },
    { to: '/report', label: 'Fireside report' },
    { to: '/about', label: 'About' },
  ],
};
