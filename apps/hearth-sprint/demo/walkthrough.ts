import type { DemoScript } from '@x10/shared/demo';

export const script: DemoScript = {
  title: 'Hearth Sprint',
  scenes: [
    {
      name: 'The hearth at dusk',
      path: '/',
      say: [
        'A stone hearth only stays warm if you tend the logs — and learning sprints work the same way.',
        'Hearth Sprint scores what teams retain, not how many videos they play at double speed.',
        'Each log on the grate is a sprint topic: thickness is effective study hours, and flame height is current retrievability.',
        'Two neglected topics have already faded to grey ash with a pale ash line on the hearthstone.',
        'On the chimney breast, the brass thermometer tracks the leading team’s mean retained hours per member.',
      ],
    },
    {
      name: 'Lenses and Today focus',
      path: '/',
      say: [
        'Switching to the Recall due lens highlights which logs are cooling below the seventy percent threshold.',
        'The Today panel surfaces fading topics, pending buddy confirmations, and your daily minute cap.',
        'Selecting your own minutes-today item traces your personal forgetting curve in soot on the chimney breast.',
      ],
      actions: [
        { type: 'click', role: 'radio', name: 'Recall due' },
        { type: 'click', role: 'button', name: /min today/ },
      ],
    },
    {
      name: 'View-as and list fallback',
      path: '/',
      say: [
        'You can switch between Host and Learner perspectives, or toggle to the accessible list view for the exact same retrievability numbers.',
      ],
      actions: [
        { type: 'click', role: 'radio', name: 'List' },
        { type: 'click', role: 'radio', name: 'Hearth' },
      ],
    },
    {
      name: 'Study log and Poker',
      path: '/study',
      say: [
        'In the Study log, building and teaching earn higher weights than passive watching, sessions under ten minutes score zero, and each day caps at one hundred eighty minutes.',
      ],
    },
    {
      name: 'Buddy bench confirmation',
      path: '/bench',
      say: [
        'Recall checks taken in Poker do not change a team’s score until a teammate confirms them on the Buddy bench.',
        'Confirming a teammate’s recall stokes their log, multiplying memory stability and lifting the team’s retained hours.',
      ],
      actions: [{ type: 'click', role: 'button', name: 'Confirm' }],
    },
  ],
};
