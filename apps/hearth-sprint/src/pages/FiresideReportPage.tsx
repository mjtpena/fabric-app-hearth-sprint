import { useCallback } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Badge,
  Button,
  DataState,
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
import { loadSprintBundle } from '../domain/sprint';

export function FiresideReportPage() {
  const { store } = useApp();
  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);
  const bundle = state.data;

  return (
    <AppShell>
      <PageHeader
        title="Fireside report"
        subtitle="Printable sprint retention summary"
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            Print report
          </Button>
        }
      />
      <DataState state={state}>
        {() =>
          bundle ? (
            <div className="space-y-6">
              <StatStrip>
                <Stat
                  label="Total retained hours"
                  value={`${bundle.snapshot.totalRetainedHours.toFixed(2)}h`}
                />
                <Stat
                  label="Leading team"
                  value={`${bundle.snapshot.teams[0]?.team ?? '—'} (${(bundle.snapshot.teams[0]?.meanRetainedHours ?? 0).toFixed(2)}h)`}
                />
                <Stat label="Learners" value={String(bundle.learners.length)} />
                <Stat label="Pending confirms" value={String(bundle.snapshot.pendingConfirms.length)} />
              </StatStrip>

              <Section title="Team standings (mean retained hours per member)">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th numeric>Rank</Th>
                        <Th>Team</Th>
                        <Th numeric>Members</Th>
                        <Th numeric>Mean R</Th>
                        <Th numeric>Total retained</Th>
                        <Th numeric>Score / member</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {bundle.snapshot.teams.map((t) => (
                        <Tr key={t.team}>
                          <Td numeric>#{t.rank}</Td>
                          <Td className="font-medium">{t.team}</Td>
                          <Td numeric>{t.memberCount}</Td>
                          <Td numeric>{(t.meanR * 100).toFixed(0)}%</Td>
                          <Td numeric>{t.totalRetainedHours.toFixed(2)}h</Td>
                          <Td numeric className="font-semibold">
                            {t.meanRetainedHours.toFixed(2)}h
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              </Section>

              <Section title="Learner breakdown">
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Learner</Th>
                        <Th>Team</Th>
                        <Th numeric>Effective hrs</Th>
                        <Th numeric>Retained hrs</Th>
                        <Th numeric>Mean R</Th>
                        <Th numeric>Today min</Th>
                        <Th>Cap</Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {[...bundle.snapshot.learners]
                        .sort((a, b) => b.retainedHours - a.retainedHours)
                        .map((l) => (
                          <Tr key={l.learner.id}>
                            <Td className="font-medium">{l.learner.personName}</Td>
                            <Td className="text-muted">{l.learner.team}</Td>
                            <Td numeric>{l.effectiveHours.toFixed(2)}h</Td>
                            <Td numeric>{l.retainedHours.toFixed(2)}h</Td>
                            <Td numeric>{(l.meanR * 100).toFixed(0)}%</Td>
                            <Td numeric>{l.minutesToday}</Td>
                            <Td>
                              {l.rawMinutesToday > CONFIG.maxMinutesPerDay ? (
                                <Badge tone="warn">Capped</Badge>
                              ) : (
                                <Badge tone="neutral">OK</Badge>
                              )}
                            </Td>
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
