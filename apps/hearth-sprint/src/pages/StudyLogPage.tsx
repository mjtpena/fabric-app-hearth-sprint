import { useCallback, useMemo, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  Button,
  Callout,
  Card,
  DataState,
  Field,
  InlineError,
  Input,
  PageHeader,
  Section,
  Select,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  TextArea,
  Th,
  Tr,
} from '@x10/shared/ui';

import { CONFIG, KIND_LABELS } from '../domain/config';
import { loadSprintBundle, logStudySession } from '../domain/sprint';
import type { StudyKind } from '../model';

export function StudyLogPage() {
  const { store, me } = useApp();
  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);

  const [topicId, setTopicId] = useState('');
  const [minutes, setMinutes] = useState('45');
  const [kind, setKind] = useState<StudyKind>('build');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const bundle = state.data;
  const activeTopicId = topicId || bundle?.topics[0]?.id || '';
  const myLearner = bundle?.snapshot.learners.find((l) => l.learner.personSub === me.sub);

  const parsedMinutes = Number(minutes) || 0;
  const remainingToday = Math.max(0, CONFIG.maxMinutesPerDay - (myLearner?.minutesToday ?? 0));
  const previewCounted =
    parsedMinutes < CONFIG.minSessionMinutes ? 0 : Math.min(parsedMinutes, remainingToday);
  const previewEffHours = (previewCounted / 60) * CONFIG.kindWeights[kind];

  const myStudies = useMemo(() => {
    if (!bundle) return [];
    const topicMap = new Map(bundle.topics.map((t) => [t.id, t.title]));
    return bundle.studies
      .filter((s) => s.learnerSub === me.sub)
      .sort((a, b) => b.day.localeCompare(a.day))
      .map((s) => ({ ...s, topicTitle: topicMap.get(s.topicId) ?? 'Topic' }));
  }, [bundle, me.sub]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle?.sprint) return;
    setError(null);
    setSavedMsg(null);
    setSaving(true);
    try {
      await logStudySession(store, me, {
        sprintId: bundle.sprint.id,
        topicId: activeTopicId,
        day: new Date().toISOString(),
        minutes: parsedMinutes,
        kind,
        note,
      });
      setNote('');
      setSavedMsg(
        parsedMinutes < CONFIG.minSessionMinutes
          ? 'Session logged (under 10 min counts 0 effective hours).'
          : `Logged ${parsedMinutes} min (${previewEffHours.toFixed(2)} effective hrs).`,
      );
      await state.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log study session.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Study log" subtitle="Log study sessions weighted by active recall value" />
      <DataState state={state}>
        {() =>
          bundle ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat
                  label="Today's minutes"
                  value={`${myLearner?.minutesToday ?? 0} / ${CONFIG.maxMinutesPerDay}`}
                />
                <Stat
                  label="Effective hours"
                  value={`${(myLearner?.effectiveHours ?? 0).toFixed(2)}h`}
                />
                <Stat
                  label="Retained hours"
                  value={`${(myLearner?.retainedHours ?? 0).toFixed(2)}h`}
                />
                <Stat
                  label="Mean R"
                  value={`${((myLearner?.meanR ?? 0) * 100).toFixed(0)}%`}
                />
              </StatStrip>

              <Section title="Log a session">
                <Card>
                  <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
                    <Field label="Topic" htmlFor="study-topic">
                      <Select
                        id="study-topic"
                        aria-label="Topic"
                        value={activeTopicId}
                        onChange={(e) => setTopicId(e.target.value)}
                      >
                        {bundle.topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Study kind" htmlFor="study-kind">
                      <Select
                        id="study-kind"
                        aria-label="Study kind"
                        value={kind}
                        onChange={(e) => setKind(e.target.value as StudyKind)}
                      >
                        {(['read', 'watch', 'build', 'teach'] as const).map((k) => (
                          <option key={k} value={k}>
                            {KIND_LABELS[k]} (×{CONFIG.kindWeights[k].toFixed(1)})
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Minutes" htmlFor="study-minutes">
                      <Input
                        id="study-minutes"
                        aria-label="Minutes"
                        type="number"
                        min={1}
                        max={600}
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                      />
                    </Field>

                    <Field label="Counted preview" htmlFor="study-preview">
                      <div id="study-preview" className="flex h-10 items-center gap-2 text-sm">
                        <span className="font-mono font-semibold">
                          {previewEffHours.toFixed(2)} eff hrs
                        </span>
                        {parsedMinutes < CONFIG.minSessionMinutes && (
                          <Badge tone="warn">Under 10 min = 0</Badge>
                        )}
                        {parsedMinutes >= CONFIG.minSessionMinutes && parsedMinutes > remainingToday && (
                          <Badge tone="warn">Capped at {remainingToday} min</Badge>
                        )}
                      </div>
                    </Field>

                    <div className="sm:col-span-2">
                      <Field label="Note (optional)" htmlFor="study-note">
                        <TextArea
                          id="study-note"
                          aria-label="Note"
                          rows={2}
                          maxLength={200}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="What did you build, teach, or summarise?"
                        />
                      </Field>
                    </div>

                    {error && (
                      <div className="sm:col-span-2">
                        <InlineError error={error} />
                      </div>
                    )}
                    {savedMsg && (
                      <div className="sm:col-span-2">
                        <Callout tone="ok" title="Session recorded">
                          {savedMsg}
                        </Callout>
                      </div>
                    )}

                    <div className="sm:col-span-2 flex justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Logging…' : 'Log session'}
                      </Button>
                    </div>
                  </form>
                </Card>
              </Section>

              <Section title="Your recent sessions">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Date</Th>
                        <Th>Topic</Th>
                        <Th>Kind</Th>
                        <Th numeric>Minutes</Th>
                        <Th>Note</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {myStudies.map((s) => (
                        <Tr key={s.id}>
                          <Td className="font-mono text-muted">{s.day.slice(0, 10)}</Td>
                          <Td className="font-medium">{s.topicTitle}</Td>
                          <Td>
                            <Badge tone={s.kind === 'teach' || s.kind === 'build' ? 'ok' : 'neutral'}>
                              {KIND_LABELS[s.kind]}
                            </Badge>
                          </Td>
                          <Td numeric>{s.minutes}</Td>
                          <Td className="text-muted">{s.note ?? '—'}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Section>
            </div>
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
