import { useCallback, useState } from 'react';
import { AppShell, useApp } from '@x10/shared/runtime';
import { useAsync } from '@x10/shared/lib';
import {
  Button,
  Card as UiCard,
  DataState,
  Field,
  InlineError,
  PageHeader,
  Section,
  Select,
  Table,
  TableWrap,
  Td,
  TextArea,
  Th,
  Tr,
} from '@x10/shared/ui';

import { deleteCard, loadSprintBundle, saveCard } from '../domain/sprint';

export function CardBankPage() {
  const { store, me } = useApp();
  const load = useCallback(() => loadSprintBundle(store), [store]);
  const state = useAsync(load, [load]);

  const [filterTopic, setFilterTopic] = useState('all');
  const [topicId, setTopicId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bundle = state.data;
  const activeTopicId = topicId || bundle?.topics[0]?.id || '';

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle?.sprint) return;
    setError(null);
    setSaving(true);
    try {
      await saveCard(store, me, {
        sprintId: bundle.sprint.id,
        topicId: activeTopicId,
        prompt,
        answer,
      });
      setPrompt('');
      setAnswer('');
      await state.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save card.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Card bank" subtitle="Questions drawn for spaced recall checks" />
      <DataState state={state}>
        {() =>
          bundle ? (
            <div className="space-y-6">
              <Section title="Add a recall card">
                <UiCard>
                  <form onSubmit={onCreate} className="grid gap-4">
                    <Field label="Topic" htmlFor="card-topic">
                      <Select
                        id="card-topic"
                        aria-label="Card topic"
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
                    <Field label="Prompt" htmlFor="card-prompt">
                      <TextArea
                        id="card-prompt"
                        aria-label="Prompt"
                        rows={2}
                        maxLength={200}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Write a concise recall question…"
                      />
                    </Field>
                    <Field label="Answer" htmlFor="card-answer">
                      <TextArea
                        id="card-answer"
                        aria-label="Answer"
                        rows={2}
                        maxLength={200}
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Key concept the learner should recall…"
                      />
                    </Field>
                    {error && <InlineError error={error} />}
                    <div className="flex justify-end">
                      <Button type="submit" disabled={saving}>
                        {saving ? 'Saving…' : 'Add card'}
                      </Button>
                    </div>
                  </form>
                </UiCard>
              </Section>

              <Section
                title={`Bank (${bundle.cards.length} cards)`}
                actions={
                  <Select
                    aria-label="Filter topic"
                    value={filterTopic}
                    onChange={(e) => setFilterTopic(e.target.value)}
                  >
                    <option value="all">All topics</option>
                    {bundle.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </Select>
                }
              >
                <TableWrap>
                  <Table>
                    <thead>
                      <Tr>
                        <Th>Topic</Th>
                        <Th>Prompt</Th>
                        <Th>Answer</Th>
                        <Th>Author</Th>
                        <Th></Th>
                      </Tr>
                    </thead>
                    <tbody>
                      {bundle.cards
                        .filter((c) => filterTopic === 'all' || c.topicId === filterTopic)
                        .map((c) => {
                          const topic = bundle.topics.find((t) => t.id === c.topicId);
                          const canDelete = c.authorSub === me.sub || me.isAdmin;
                          return (
                            <Tr key={c.id}>
                              <Td className="text-muted">{topic?.title ?? '—'}</Td>
                              <Td className="font-medium">{c.prompt}</Td>
                              <Td className="text-muted">{c.answer}</Td>
                              <Td className="text-muted">{c.authorName}</Td>
                              <Td numeric>
                                {canDelete && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      await deleteCard(store, me, c);
                                      await state.reload();
                                    }}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </Td>
                            </Tr>
                          );
                        })}
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
