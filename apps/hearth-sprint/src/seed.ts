import type { DataStore } from '@x10/shared/data';
import type { SeedContext } from '@x10/shared/runtime';

import type { Schema, StudyKind } from './model';
import { createPrng, hashString, MS_PER_DAY } from './domain/rules';

const SPRINT_DAYS = 21;
const CURRENT_DAY = 12;

const TOPICS = [
  { key: 'semantic', title: 'Semantic Model Design', weight: 1.0 },
  { key: 'dax', title: 'DAX Window Functions', weight: 1.0 },
  { key: 'lakehouse', title: 'Delta Lakehouse Tuning', weight: 1.0 },
  { key: 'security', title: 'Row-Level Security', weight: 1.0 },
  { key: 'pipelines', title: 'Incremental Pipelines', weight: 1.0 },
] as const;

const CARDS_BY_TOPIC: Record<string, Array<{ prompt: string; answer: string }>> = {
  semantic: [
    { prompt: 'Why prefer a star schema over a flat wide table in Direct Lake?', answer: 'Dimension tables compress with dictionary encoding and avoid repeating long text attributes across fact rows.' },
    { prompt: 'What does a bi-directional cross-filter risk in a multi-fact model?', answer: 'Ambiguous filter paths and unexpected row-level security leaks across unrelated facts.' },
    { prompt: 'When should a calculated column be moved upstream to the lakehouse?', answer: 'Whenever it is high-cardinality or needed for joins, so VertiPaq compresses it during framing.' },
    { prompt: 'What is the purpose of a role-playing date dimension?', answer: 'Allowing order date and ship date to filter independently without inactive relationship confusion.' },
    { prompt: 'How do calculation groups reduce measure sprawl?', answer: 'They apply reusable time-intelligence or formatting expressions across any base measure.' },
    { prompt: 'What triggers Direct Lake fallback to DirectQuery?', answer: 'Exceeding the SKU row or memory guardrails, or referencing SQL views not backed by Delta.' },
  ],
  dax: [
    { prompt: 'What does PARTITIONBY control inside WINDOW()?', answer: 'It resets the window frame per group, similar to SQL PARTITION BY.' },
    { prompt: 'How does OFFSET(-1) behave at the first row of a partition?', answer: 'It returns an empty table rather than wrapping around to the last row.' },
    { prompt: 'Why use REMOVEFILTERS instead of ALL as a CALCULATE modifier?', answer: 'REMOVEFILTERS clearly signals intent to clear filters and cannot be misused as a table expression.' },
    { prompt: 'When is KEEPFILTERS needed in a CALCULATE predicate?', answer: 'When you want to intersect the new filter with existing visual filters instead of overwriting them.' },
    { prompt: 'What does INDEX(1, ...) return when sorted descending?', answer: 'The single top-ranked row within each partition according to the ORDERBY clause.' },
    { prompt: 'Why store a sub-expression in a VAR before an IF branch?', answer: 'Variables evaluate once in their defining filter context, avoiding duplicate scans.' },
  ],
  lakehouse: [
    { prompt: 'What does V-Order optimise on Delta Parquet files?', answer: 'Columnar sorting and run-length encoding for faster VertiPaq and Spark reads.' },
    { prompt: 'Why run OPTIMIZE before VACUUM on a busy table?', answer: 'OPTIMIZE compacts small files into larger ones; VACUUM then removes obsolete files past retention.' },
    { prompt: 'What is the default retention window for Delta VACUUM?', answer: 'Seven days (168 hours), protecting concurrent readers and time-travel queries.' },
    { prompt: 'When does Z-ORDER help more than partitioning?', answer: 'On high-cardinality filter columns where partitioning would create thousands of tiny files.' },
    { prompt: 'What is the small-file problem in streaming ingestion?', answer: 'Many tiny Parquet files inflate metadata overhead and slow query planning.' },
    { prompt: 'How does liquid clustering improve on static partitioning?', answer: 'It adapts file layout incrementally without rewriting the entire table when access patterns shift.' },
  ],
  security: [
    { prompt: 'Why must RLS policies never rely solely on client-side filtering?', answer: 'Direct GraphQL or SQL queries bypass the UI; the database engine must enforce the predicate.' },
    { prompt: 'What is separation of duties in a review workflow?', answer: 'The person who submits or creates a record cannot be the same person who approves or confirms it.' },
    { prompt: 'Why exclude ownerSub from update policies?', answer: 'So a caller cannot reassign ownership of a row to another user after creation.' },
    { prompt: 'How does dynamic RLS use claims.sub?', answer: 'It matches the authenticated token subject directly against an owner or membership column.' },
    { prompt: 'What happens if an entity has no explicit @role decorator?', answer: 'Default access may be broader or narrower than intended; explicit @role makes every action auditable.' },
    { prompt: 'Why keep a server-side cap on daily confirmations?', answer: 'To prevent rubber-stamping bursts from inflating team scores in a single sitting.' },
  ],
  pipelines: [
    { prompt: 'What makes a watermark column safe for incremental loads?', answer: 'Monotonically increasing timestamps or sequence IDs updated on every insert and modification.' },
    { prompt: 'Why make pipeline stages idempotent?', answer: 'Re-running a failed slice produces the same table state without duplicating rows.' },
    { prompt: 'What is the difference between soft delete and hard delete in CDC?', answer: 'Soft deletes flag a row as inactive so downstream incremental loads can propagate the removal.' },
    { prompt: 'Why separate bronze, silver, and gold layers?', answer: 'Bronze preserves raw history, silver cleans and conforms, and gold serves curated business metrics.' },
    { prompt: 'What is backpressure in a scheduled ingestion pipeline?', answer: 'Slowing or batching upstream pulls when downstream sinks cannot commit fast enough.' },
    { prompt: 'How do you verify an incremental load did not miss late-arriving rows?', answer: 'Use a rolling lookback window and reconcile row counts against the source watermark.' },
  ],
};

const LEARNERS = [
  { sub: 'demo-admin', name: 'Maren Solberg', team: 'Birch' },
  { sub: 'demo-learner', name: 'Devon Okafor', team: 'Birch' },
  { sub: 'demo-buddy', name: 'Tessa Lindqvist', team: 'Birch' },
  { sub: 'learner-4', name: 'Hana Takahashi', team: 'Birch' },
  { sub: 'learner-5', name: 'Mateo Alvarez', team: 'Cedar' },
  { sub: 'learner-6', name: 'Priya Nair', team: 'Cedar' },
  { sub: 'learner-7', name: 'Caleb Novak', team: 'Cedar' },
  { sub: 'learner-8', name: 'Nadia Benali', team: 'Cedar' },
  { sub: 'learner-9', name: 'Owen Gallagher', team: 'Alder' },
  { sub: 'learner-10', name: 'Sora Kim', team: 'Alder' },
  { sub: 'learner-11', name: 'Freya Holm', team: 'Alder' },
  { sub: 'learner-12', name: 'Julian Mensah', team: 'Alder' },
] as const;

const STUDY_KINDS: StudyKind[] = ['read', 'watch', 'build', 'teach'];

export async function seed(store: DataStore<Schema>, ctx: SeedContext): Promise<void> {
    const sprints = store.repo('Sprint');
    const topicsRepo = store.repo('Topic');
    const cardsRepo = store.repo('Card');
    const learnersRepo = store.repo('Learner');
    const studiesRepo = store.repo('Study');
    const recallsRepo = store.repo('Recall');
    const confirmsRepo = store.repo('Confirm');

    const nowMs = ctx.now.getTime();
    const startsOn = new Date(nowMs - (CURRENT_DAY - 1) * MS_PER_DAY).toISOString();
    const endsOn = new Date(nowMs + (SPRINT_DAYS - CURRENT_DAY) * MS_PER_DAY).toISOString();
    const daysAgoIso = (days: number, hourOffset = 0) =>
      new Date(nowMs - days * MS_PER_DAY + hourOffset * 3_600_000).toISOString();

    const sprint = await sprints.create({
      name: 'Winter Hearth Learning Sprint',
      startsOn,
      endsOn,
      hostSub: 'demo-admin',
    });

    const topicMap = new Map<string, string>();
    for (const t of TOPICS) {
      const created = await topicsRepo.create({
        sprintId: sprint.id,
        hostSub: 'demo-admin',
        title: t.title,
        weight: t.weight,
      });
      topicMap.set(t.key, created.id);

      const cards = CARDS_BY_TOPIC[t.key] ?? [];
      for (const c of cards) {
        await cardsRepo.create({
          topicId: created.id,
          sprintId: sprint.id,
          authorSub: 'demo-admin',
          authorName: 'Maren Solberg',
          prompt: c.prompt,
          answer: c.answer,
        });
      }
    }

    for (const l of LEARNERS) {
      await learnersRepo.create({
        sprintId: sprint.id,
        personSub: l.sub,
        personName: l.name,
        team: l.team,
      });
    }

    const topicIds = TOPICS.map((t) => topicMap.get(t.key)!);
    // Two topics ("security" index 3 and "pipelines" index 4) have gone to ash for most learners
    // (last touched 8-11 days ago with no recent recalls)
    const rng = createPrng(hashString('hearth-sprint-seed-v1'));

    // ~90 study sessions across 12 learners & 5 topics
    for (let li = 0; li < LEARNERS.length; li++) {
      const learner = LEARNERS[li];
      for (let ti = 0; ti < topicIds.length; ti++) {
        const topicId = topicIds[ti];
        const isAshTopic = ti >= 3;

        if (isAshTopic) {
          // Studied early in the sprint (days 9-11 ago), never revisited -> fades to grey ash
          await studiesRepo.create({
            sprintId: sprint.id,
            topicId,
            learnerSub: learner.sub,
            day: daysAgoIso(9 + (li % 3), -(ti + 1)),
            minutes: 35 + Math.floor(rng() * 35),
            kind: ti === 3 ? 'read' : 'watch',
            note: 'Initial walkthrough notes',
          });
          continue;
        }

        // Active topics: 2 sessions per learner-topic
        const firstAgo = 6 + (li % 4) + ti;
        const secondAgo = ti === 0 ? 0.5 + (li % 3) * 0.4 : 1.5 + (li % 4) * 0.6;
        const kind1 = STUDY_KINDS[(li + ti) % STUDY_KINDS.length];
        const kind2 = STUDY_KINDS[(li + ti + 2) % STUDY_KINDS.length];

        await studiesRepo.create({
          sprintId: sprint.id,
          topicId,
          learnerSub: learner.sub,
          day: daysAgoIso(firstAgo, -2),
          minutes: 30 + Math.floor(rng() * 40),
          kind: kind1,
          note: `Worked through ${TOPICS[ti].title.toLowerCase()}`,
        });

        await studiesRepo.create({
          sprintId: sprint.id,
          topicId,
          learnerSub: learner.sub,
          day: daysAgoIso(secondAgo, -1),
          minutes: 25 + Math.floor(rng() * 45),
          kind: kind2,
          note: kind2 === 'teach' ? 'Paired walkthrough with team' : 'Hands-on practice lab',
        });
      }
    }

    // One padded-minutes learner at the 180-minute daily cap today (Caleb Novak, learner-7)
    await studiesRepo.create({
      sprintId: sprint.id,
      topicId: topicIds[0],
      learnerSub: 'learner-7',
      day: daysAgoIso(0, -4),
      minutes: 120,
      kind: 'watch',
      note: 'Morning video binge',
    });
    await studiesRepo.create({
      sprintId: sprint.id,
      topicId: topicIds[1],
      learnerSub: 'learner-7',
      day: daysAgoIso(0, -1),
      minutes: 110,
      kind: 'watch',
      note: 'Afternoon marathon (capped at 180 min/day)',
    });

    // Give Devon (demo-learner) a short 45-min session today so TodayPanel shows minutes against cap
    await studiesRepo.create({
      sprintId: sprint.id,
      topicId: topicIds[0],
      learnerSub: 'demo-learner',
      day: daysAgoIso(0, -2),
      minutes: 45,
      kind: 'build',
      note: 'Refactored star schema measures',
    });

    // 25 recalls: 18 confirmed passing/high, 3 confirmed failed, 4 awaiting confirmation
    const recallSpecs: Array<{
      learnerIdx: number;
      topicIdx: number;
      daysAgo: number;
      correct: number;
      status: 'confirmed' | 'pending';
    }> = [
      // 18 confirmed passing/high
      { learnerIdx: 0, topicIdx: 0, daysAgo: 0.4, correct: 5, status: 'confirmed' },
      { learnerIdx: 0, topicIdx: 1, daysAgo: 1.2, correct: 4, status: 'confirmed' },
      { learnerIdx: 1, topicIdx: 0, daysAgo: 0.6, correct: 5, status: 'confirmed' },
      { learnerIdx: 1, topicIdx: 2, daysAgo: 2.1, correct: 4, status: 'confirmed' },
      { learnerIdx: 2, topicIdx: 0, daysAgo: 1.0, correct: 5, status: 'confirmed' },
      { learnerIdx: 2, topicIdx: 1, daysAgo: 0.8, correct: 4, status: 'confirmed' },
      { learnerIdx: 3, topicIdx: 1, daysAgo: 1.5, correct: 5, status: 'confirmed' },
      { learnerIdx: 4, topicIdx: 0, daysAgo: 0.5, correct: 5, status: 'confirmed' },
      { learnerIdx: 4, topicIdx: 1, daysAgo: 1.3, correct: 4, status: 'confirmed' },
      { learnerIdx: 5, topicIdx: 0, daysAgo: 0.7, correct: 5, status: 'confirmed' },
      { learnerIdx: 5, topicIdx: 2, daysAgo: 1.1, correct: 4, status: 'confirmed' },
      { learnerIdx: 6, topicIdx: 0, daysAgo: 2.0, correct: 4, status: 'confirmed' },
      { learnerIdx: 7, topicIdx: 1, daysAgo: 1.4, correct: 5, status: 'confirmed' },
      { learnerIdx: 8, topicIdx: 0, daysAgo: 0.9, correct: 4, status: 'confirmed' },
      { learnerIdx: 8, topicIdx: 2, daysAgo: 1.6, correct: 5, status: 'confirmed' },
      { learnerIdx: 9, topicIdx: 1, daysAgo: 1.0, correct: 4, status: 'confirmed' },
      { learnerIdx: 10, topicIdx: 0, daysAgo: 1.8, correct: 5, status: 'confirmed' },
      { learnerIdx: 11, topicIdx: 2, daysAgo: 1.2, correct: 4, status: 'confirmed' },
      // 3 confirmed failed (< 70%)
      { learnerIdx: 3, topicIdx: 2, daysAgo: 1.0, correct: 2, status: 'confirmed' },
      { learnerIdx: 6, topicIdx: 2, daysAgo: 1.5, correct: 1, status: 'confirmed' },
      { learnerIdx: 10, topicIdx: 1, daysAgo: 1.2, correct: 2, status: 'confirmed' },
      // 4 awaiting confirmation
      { learnerIdx: 1, topicIdx: 1, daysAgo: 0.2, correct: 5, status: 'pending' },
      { learnerIdx: 2, topicIdx: 2, daysAgo: 0.3, correct: 4, status: 'pending' },
      { learnerIdx: 4, topicIdx: 2, daysAgo: 0.25, correct: 5, status: 'pending' },
      { learnerIdx: 9, topicIdx: 0, daysAgo: 0.15, correct: 4, status: 'pending' },
    ];

    for (let i = 0; i < recallSpecs.length; i++) {
      const spec = recallSpecs[i];
      const learner = LEARNERS[spec.learnerIdx];
      const takenAt = daysAgoIso(spec.daysAgo, 0);
      const recall = await recallsRepo.create({
        sprintId: sprint.id,
        topicId: topicIds[spec.topicIdx],
        learnerSub: learner.sub,
        takenAt,
        items: 5,
        correct: spec.correct,
      });

      if (spec.status === 'confirmed') {
        const confirmer = LEARNERS[(spec.learnerIdx + 1) % LEARNERS.length];
        await confirmsRepo.create({
          recallId: recall.id,
          sprintId: sprint.id,
          confirmerSub: confirmer.sub,
          agrees: true,
          at: daysAgoIso(Math.max(0.05, spec.daysAgo - 0.05), 0),
        });
      }
    }
}
