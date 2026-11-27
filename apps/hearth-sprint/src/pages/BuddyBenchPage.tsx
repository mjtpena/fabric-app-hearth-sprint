import { useCallback, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync, usePolling } from '@x10/shared/lib';
import {
  Badge,
  Button,
  Callout,
  DataState,
  EmptyState,
  InlineError,
  PageHeader,
  Section,
  Stat,
  StatStrip,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@x10/shared/ui';

import { CONFIG } from '../domain/config';
import { confirmsByPersonOnDay } from '../domain/rules';
import { confirmRecall, loadSprintBundle } from '../domain/sprint';

export function BuddyBenchPage() {
  const { store, me } = useApp();
  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);
  usePolling(state.reload, 5000);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const bundle = state.data;
  const myTodayConfirms = bundle
    ? confirmsByPersonOnDay(bundle.confirms, me.sub, bundle.nowIso)
    : 0;

  async function onDecide(recallId: string, agrees: boolean) {
    if (!bundle) return;
    const recall = bundle.recalls.find((r) => r.id === recallId);
    if (!recall) return;
    setError(null);
    setNotice(null);
    setBusyId(recallId);
    try {
      await confirmRecall(store, me, recall, agrees, bundle.nowIso);
      setNotice(agrees ? 'Recall confirmed — log stoked!' : 'Recall marked as disputed.');
      await state.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record confirmation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Buddy bench" subtitle="Confirm a teammate's recall check to stoke their log" />
      <DataState state={state}>
        {() =>
          bundle ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat
                  label="Awaiting confirmation"
                  value={String(bundle.snapshot.pendingConfirms.length)}
                />
                <Stat
                  label="Your confirms today"
                  value={`${myTodayConfirms} / ${CONFIG.maxConfirmsPerDay}`}
                />
              </StatStrip>

              {error && <InlineError error={error} />}
              {notice && (
                <Callout tone="ok" title="Buddy check recorded">
                  {notice}
                </Callout>
              )}

              <Section title="Pending recall checks">
                {bundle.snapshot.pendingConfirms.length === 0 ? (
                  <EmptyState title="All caught up">
                    No recall checks are waiting for teammate confirmation.
                  </EmptyState>
                ) : (
                  <TableWrap>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>Learner</Th>
                          <Th>Team</Th>
                          <Th>Topic</Th>
                          <Th numeric>Score</Th>
                          <Th>Taken</Th>
                          <Th numeric>Action</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {bundle.snapshot.pendingConfirms.map((p) => {
                          const isOwn = p.recall.learnerSub === me.sub;
                          return (
                            <Tr key={p.recall.id}>
                              <Td className="font-medium">{p.learnerName}</Td>
                              <Td className="text-muted">{p.team}</Td>
                              <Td>{p.topicTitle}</Td>
                              <Td numeric>
                                {p.recall.correct}/{p.recall.items} ({Math.round(p.accuracy * 100)}%)
                              </Td>
                              <Td className="font-mono text-muted">{p.recall.takenAt.slice(0, 10)}</Td>
                              <Td numeric>
                                {isOwn ? (
                                  <Badge tone="neutral">Your own recall</Badge>
                                ) : (
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      size="sm"
                                      disabled={busyId === p.recall.id}
                                      onClick={() => onDecide(p.recall.id, true)}
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      disabled={busyId === p.recall.id}
                                      onClick={() => onDecide(p.recall.id, false)}
                                    >
                                      Dispute
                                    </Button>
                                  </div>
                                )}
                              </Td>
                            </Tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </TableWrap>
                )}
              </Section>
            </div>
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
