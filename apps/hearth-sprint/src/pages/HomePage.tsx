import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync, usePolling } from '@x10/shared/lib';
import {
  Badge,
  DataState,
  Legend,
  LensBar,
  StagePage,
  Table,
  TableWrap,
  Td,
  Th,
  TodayPanel,
  Tr,
  ViewAsSwitch,
  ViewToggle,
  type TodayItem,
} from '@x10/shared/ui';

import { CONFIG } from '../domain/config';
import { loadSprintBundle } from '../domain/sprint';
import { HearthStage, type HearthLens } from '../hearth/HearthStage';

const LENSES: Array<{ value: HearthLens; label: string; key: string }> = [
  { value: 'retrievability', label: 'Retrievability', key: '1' },
  { value: 'retained', label: 'Retained hours', key: '2' },
  { value: 'due', label: 'Recall due', key: '3' },
  { value: 'kinds', label: 'Study kind mix', key: '4' },
  { value: 'team', label: 'Team', key: '5' },
];

export function HomePage() {
  const { store, me } = useApp();
  const navigate = useNavigate();

  const [view, setView] = useState<'stage' | 'list'>('stage');
  const [lens, setLens] = useState<HearthLens>('retrievability');
  const [viewAs, setViewAs] = useState<'learner' | 'host'>(me.isAdmin ? 'host' : 'learner');
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedLearnerSub, setSelectedLearnerSub] = useState<string | null>(null);

  const forceSvg = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return (
      new URLSearchParams(window.location.search).has('nowebgl') ||
      window.location.hash.includes('nowebgl')
    );
  }, []);

  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);
  usePolling(state.reload, 5000);

  const bundle = state.data;
  const snapshot = bundle?.snapshot;

  const todayItems: TodayItem[] = useMemo(() => {
    if (!snapshot) return [];
    const items: TodayItem[] = [];

    // 1. Topics about to fade (R < 0.7)
    const fading = [...snapshot.topics]
      .filter((t) => t.meanR < CONFIG.recallDueThreshold)
      .sort((a, b) => a.meanR - b.meanR)[0];
    if (fading) {
      items.push({
        id: `fade-${fading.topic.id}`,
        title: `${fading.topic.title} fading`,
        meta: `Mean R ${(fading.meanR * 100).toFixed(0)}% · ${fading.dueCount} learners due`,
        severity: fading.meanR < CONFIG.ashThreshold ? 'bad' : 'warn',
      });
    }

    // 2. Recalls waiting for your confirmation
    const confirmable = snapshot.pendingConfirms.filter((p) => p.recall.learnerSub !== me.sub);
    if (confirmable.length > 0) {
      items.push({
        id: 'pending-confirms',
        title: `${confirmable.length} recalls awaiting buddy check`,
        meta: `Next: ${confirmable[0].learnerName} on ${confirmable[0].topicTitle}`,
        severity: 'warn',
      });
    }

    // 3. Minutes today against cap
    const myLearner = snapshot.learners.find((l) => l.learner.personSub === me.sub);
    if (myLearner) {
      items.push({
        id: 'minutes-cap',
        title: `${myLearner.minutesToday} / ${CONFIG.maxMinutesPerDay} min today`,
        meta: `${myLearner.retainedHours.toFixed(2)} retained hrs · inspect curve`,
        severity: myLearner.minutesToday >= CONFIG.maxMinutesPerDay ? 'warn' : 'ok',
      });
    }

    // 4. Gap to leading team
    if (snapshot.teams.length >= 2) {
      const lead = snapshot.teams[0];
      const runner = snapshot.teams[1];
      const gap = Math.max(0, lead.meanRetainedHours - runner.meanRetainedHours);
      items.push({
        id: 'team-gap',
        title: `${lead.team} leads by ${gap.toFixed(2)}h`,
        meta: `${lead.meanRetainedHours.toFixed(2)}h vs ${runner.team} ${runner.meanRetainedHours.toFixed(2)}h / member`,
        severity: 'ok',
      });
    }

    return items.slice(0, 5);
  }, [snapshot, me.sub]);

  const handleSelectToday = useCallback(
    (item: TodayItem) => {
      if (item.id.startsWith('fade-')) {
        setSelectedTopicId(item.id.replace('fade-', ''));
        setLens('retrievability');
      } else if (item.id === 'pending-confirms') {
        navigate('/bench');
      } else if (item.id === 'minutes-cap') {
        setSelectedLearnerSub(me.sub);
      } else if (item.id === 'team-gap') {
        setSelectedLearnerSub(null);
        setLens('team');
      }
    },
    [me.sub, navigate],
  );

  const legendItems = useMemo(
    () => [
      { label: 'Stoked (R ≥ 70%)', color: 'var(--accent-9)' },
      { label: 'Cooling (35–69%)', color: 'var(--warn-9)' },
      { label: 'Gone to ash (< 35%)', color: 'var(--fg-muted)' },
    ],
    [],
  );

  const selectedTopic = snapshot?.topics.find((t) => t.topic.id === selectedTopicId) ?? null;

  return (
    <AppShell immersive>
      <DataState state={state}>
        {() =>
          bundle && snapshot ? (
            <StagePage
              label="The hearth"
              view={view}
              title={bundle.sprint?.name ?? 'Hearth Sprint'}
              meta={`Day 12 of ${CONFIG.sprintDays} · ${snapshot.teams[0]?.team ?? 'Team'} leads at ${(snapshot.teams[0]?.meanRetainedHours ?? 0).toFixed(2)}h / member`}
              breadcrumb={[
                {
                  label: 'All topics',
                  onClick: () => {
                    setSelectedTopicId(null);
                    setSelectedLearnerSub(null);
                  },
                },
                ...(selectedTopic ? [{ label: selectedTopic.topic.title }] : []),
              ]}
              topRight={
                <ViewToggle
                  value={view}
                  onChange={setView}
                  stageLabel="Hearth"
                  glass={view === 'stage'}
                />
              }
              lenses={<LensBar lenses={LENSES} value={lens} onChange={setLens} />}
              legend={<Legend title="Ember state" items={legendItems} collapsible />}
              bottomRight={
                <ViewAsSwitch
                  options={[
                    { value: 'learner', label: 'Learner' },
                    { value: 'host', label: 'Host' },
                  ]}
                  value={viewAs}
                  onChange={setViewAs}
                />
              }
              side={
                <TodayPanel
                  bare
                  items={todayItems}
                  activeId={selectedTopicId ? `fade-${selectedTopicId}` : undefined}
                  onSelect={handleSelectToday}
                />
              }
              sideCount={todayItems.length}
              stage={
                <HearthStage
                  snapshot={snapshot}
                  lens={lens}
                  selectedTopicId={selectedTopicId}
                  selectedLearnerSub={selectedLearnerSub}
                  onSelectTopic={setSelectedTopicId}
                  onSelectLearner={setSelectedLearnerSub}
                  forceSvg={forceSvg}
                />
              }
              list={
                <div className="space-y-4">
                  <TableWrap>
                    <Table>
                      <thead>
                        <Tr>
                          <Th>Topic</Th>
                          <Th numeric>Retrievability (R)</Th>
                          <Th numeric>Effective hrs</Th>
                          <Th numeric>Retained hrs</Th>
                          <Th>Next due</Th>
                          <Th>Status</Th>
                        </Tr>
                      </thead>
                      <tbody>
                        {snapshot.topics.map((t) => (
                          <Tr key={t.topic.id} data-testid={`list-topic-${t.topic.id}`}>
                            <Td className="font-medium">{t.topic.title}</Td>
                            <Td numeric data-testid={`list-r-${t.topic.id}`}>
                              {(t.meanR * 100).toFixed(0)}%
                            </Td>
                            <Td numeric>{t.totalEffectiveHours.toFixed(1)}h</Td>
                            <Td numeric>{t.totalRetainedHours.toFixed(2)}h</Td>
                            <Td className="text-muted">
                              {t.nextDueAt ? t.nextDueAt.slice(0, 10) : '—'}
                            </Td>
                            <Td>
                              <Badge
                                tone={
                                  t.meanR < CONFIG.ashThreshold
                                    ? 'bad'
                                    : t.meanR < CONFIG.recallDueThreshold
                                      ? 'warn'
                                      : 'ok'
                                }
                              >
                                {t.meanR < CONFIG.ashThreshold
                                  ? 'Ash'
                                  : t.meanR < CONFIG.recallDueThreshold
                                    ? 'Recall due'
                                    : 'Stoked'}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </TableWrap>
                </div>
              }
            />
          ) : null
        }
      </DataState>
    </AppShell>
  );
}
