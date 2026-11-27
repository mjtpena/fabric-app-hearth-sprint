import { AppShell } from '@x10/shared/runtime';
import { Callout, Card, PageHeader, Section } from '@x10/shared/ui';

import { CONFIG } from '../domain/config';

export function AboutPage() {
  return (
    <AppShell>
      <PageHeader title="About Hearth Sprint" subtitle="Score what people retain, not what they sit through" />
      <div className="space-y-6 max-w-3xl">
        <Section title="Why this exists">
          <Card>
            <p className="text-sm leading-relaxed text-fg">
              Traditional learning-hours challenges reward sitting through videos at 2× speed. A
              fortnight later nobody can answer a question about what they studied. Hearth Sprint
              scores <strong>retained hours</strong>: study sessions earn weighted effective hours,
              and spaced recall checks confirmed by a teammate keep each topic&apos;s memory
              stability high.
            </p>
          </Card>
        </Section>

        <Section title="Rules & thresholds">
          <Card>
            <ul className="space-y-2 text-sm text-fg list-disc pl-5">
              <li>
                <strong>Forgetting curve:</strong> Retrievability{' '}
                <code>R = exp(-daysSince / S)</code>. Stability <code>S</code> starts at{' '}
                <strong>{CONFIG.initialStabilityDays} days</strong> after the first valid study
                session.
              </li>
              <li>
                <strong>Confirmed recalls:</strong> ≥ {Math.round(CONFIG.highRecallThreshold * 100)}%
                multiplies <code>S</code> by <strong>{CONFIG.highRecallMultiplier}×</strong>; ≥{' '}
                {Math.round(CONFIG.passRecallThreshold * 100)}% multiplies <code>S</code> by{' '}
                <strong>{CONFIG.passRecallMultiplier}×</strong>; failed recalls halve <code>S</code>{' '}
                (floor {CONFIG.minStabilityDays} day). Studying on a new day multiplies{' '}
                <code>S</code> by {CONFIG.newDayStudyMultiplier}×.
              </li>
              <li>
                <strong>Effective hours:</strong> Kind weights are read{' '}
                {CONFIG.kindWeights.read}×, watch {CONFIG.kindWeights.watch}×, build{' '}
                {CONFIG.kindWeights.build}×, teach {CONFIG.kindWeights.teach}×. Sessions under{' '}
                {CONFIG.minSessionMinutes} minutes score 0. Daily cap is {CONFIG.maxMinutesPerDay}{' '}
                minutes; topic cap is {CONFIG.maxEffectiveHoursPerTopic} effective hours.
              </li>
              <li>
                <strong>Buddy confirmation:</strong> Recalls count only after a teammate (not the
                learner) confirms them. Each person may confirm at most {CONFIG.maxConfirmsPerDay}{' '}
                recalls per day.
              </li>
              <li>
                <strong>Team score:</strong> Mean retained hours per member, so team size does not
                skew the standings.
              </li>
            </ul>
          </Card>
        </Section>

        <Callout tone="neutral" title="Model limits">
          This app uses a simplified exponential forgetting curve inspired by spaced-repetition
          research (Ebbinghaus / FSRS). It supports team learning sprints and is not a formal
          educational assessment or compliance certification tool.
        </Callout>
      </div>
    </AppShell>
  );
}
