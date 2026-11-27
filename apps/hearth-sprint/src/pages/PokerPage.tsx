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
  PageHeader,
  Section,
  Select,
} from '@x10/shared/ui';

import { drawRecallCards } from '../domain/rules';
import { loadSprintBundle, submitRecallCheck } from '../domain/sprint';

export function PokerPage() {
  const { store, me } = useApp();
  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);

  const [topicId, setTopicId] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [marks, setMarks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  const bundle = state.data;
  const activeTopicId = topicId || bundle?.topics[0]?.id || '';

  const drawnCards = useMemo(() => {
    if (!bundle || !activeTopicId) return [];
    return drawRecallCards(bundle.cards, activeTopicId, me.sub, bundle.nowIso);
  }, [bundle, activeTopicId, me.sub]);

  const markedCount = drawnCards.filter((c) => c.id in marks).length;
  const correctCount = drawnCards.filter((c) => marks[c.id] === true).length;

  async function onSubmit() {
    if (!bundle?.sprint || drawnCards.length === 0) return;
    setError(null);
    setSubmittedMsg(null);
    setSubmitting(true);
    try {
      await submitRecallCheck(store, me, {
        sprintId: bundle.sprint.id,
        topicId: activeTopicId,
        items: drawnCards.length,
        correct: correctCount,
      });
      setSubmittedMsg(
        `Submitted ${correctCount}/${drawnCards.length} for buddy confirmation. Your team's retained hours will update once a teammate confirms it.`,
      );
      setRevealed({});
      setMarks({});
      await state.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit recall.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Poker" subtitle="Stoke the fire with a 5-card recall check" />
      <DataState state={state}>
        {() =>
          bundle ? (
            <div className="space-y-6">
              <Card>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="min-w-[240px] flex-1">
                    <Field label="Topic to recall" htmlFor="poker-topic">
                      <Select
                        id="poker-topic"
                        aria-label="Topic to recall"
                        value={activeTopicId}
                        onChange={(e) => {
                          setTopicId(e.target.value);
                          setRevealed({});
                          setMarks({});
                          setSubmittedMsg(null);
                        }}
                      >
                        {bundle.topics.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="text-sm text-muted font-mono">
                    Marked: {markedCount} / {drawnCards.length} · Correct: {correctCount}
                  </div>
                </div>
              </Card>

              {error && <InlineError error={error} />}
              {submittedMsg && (
                <Callout tone="ok" title="Sent to Buddy bench">
                  {submittedMsg}
                </Callout>
              )}

              <Section title="Today's 5-card draw">
                <div className="space-y-3">
                  {drawnCards.map((card, idx) => {
                    const isRev = !!revealed[card.id];
                    const mark = marks[card.id];
                    return (
                      <Card key={card.id}>
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="font-mono text-xs text-muted">Card {idx + 1}</span>
                              <p className="mt-1 font-medium text-fg">{card.prompt}</p>
                            </div>
                            {mark !== undefined && (
                              <Badge tone={mark ? 'ok' : 'bad'}>
                                {mark ? 'Recalled' : 'Missed'}
                              </Badge>
                            )}
                          </div>

                          {isRev ? (
                            <div className="rounded-md bg-surface-2 p-3 text-sm text-fg">
                              <span className="font-mono text-xs text-muted block mb-1">
                                Reference answer
                              </span>
                              {card.answer}
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-2">
                            {!isRev && (
                              <Button
                                variant="secondary"
                                onClick={() => setRevealed((r) => ({ ...r, [card.id]: true }))}
                              >
                                Reveal answer
                              </Button>
                            )}
                            <Button
                              variant={mark === true ? 'primary' : 'secondary'}
                              onClick={() => {
                                setRevealed((r) => ({ ...r, [card.id]: true }));
                                setMarks((m) => ({ ...m, [card.id]: true }));
                              }}
                            >
                              Got it
                            </Button>
                            <Button
                              variant={mark === false ? 'danger' : 'secondary'}
                              onClick={() => {
                                setRevealed((r) => ({ ...r, [card.id]: true }));
                                setMarks((m) => ({ ...m, [card.id]: false }));
                              }}
                            >
                              Missed
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </Section>

              <div className="flex justify-end">
                <Button
                  onClick={onSubmit}
                  disabled={submitting || markedCount < drawnCards.length || drawnCards.length === 0}
                >
                  {submitting ? 'Submitting…' : 'Send for confirmation'}
                </Button>
              </div>
            </div>
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
