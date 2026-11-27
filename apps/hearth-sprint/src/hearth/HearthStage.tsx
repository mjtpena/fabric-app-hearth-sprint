import { useEffect, useRef } from 'react';
import { useReducedMotion, useThemeColors } from '@x10/shared/ui';

import { CONFIG } from '../domain/config';
import type { LearnerSummary, LogSummary, SprintSnapshot, TopicSummary } from '../domain/rules';
import { retrievability } from '../domain/rules';

export type HearthLens = 'retrievability' | 'retained' | 'due' | 'kinds' | 'team';

interface HearthStageProps {
  snapshot: SprintSnapshot;
  lens: HearthLens;
  selectedTopicId: string | null;
  selectedLearnerSub: string | null;
  onSelectTopic: (topicId: string | null) => void;
  onSelectLearner: (learnerSub: string | null) => void;
  forceSvg?: boolean;
}

interface LogDisplay {
  topicId: string;
  title: string;
  r: number;
  effectiveHours: number;
  retainedHours: number;
  isDue: boolean;
  isAsh: boolean;
  dueCount: number;
  kindMinutes: { read: number; watch: number; build: number; teach: number };
  stabilityDays?: number;
}

function buildLogDisplays(
  snapshot: SprintSnapshot,
  selectedLearner: LearnerSummary | null,
): LogDisplay[] {
  if (selectedLearner) {
    return selectedLearner.logs.map((l: LogSummary) => ({
      topicId: l.topicId,
      title: l.topicTitle,
      r: l.memory.retrievability,
      effectiveHours: l.effectiveHours,
      retainedHours: l.retainedHours,
      isDue: l.memory.isDue,
      isAsh: l.memory.isAsh,
      dueCount: l.memory.isDue ? 1 : 0,
      kindMinutes: l.kindMinutes,
      stabilityDays: l.memory.stabilityDays,
    }));
  }
  return snapshot.topics.map((t: TopicSummary) => ({
    topicId: t.topic.id,
    title: t.topic.title,
    r: t.meanR,
    effectiveHours: t.totalEffectiveHours / Math.max(1, snapshot.learners.length),
    retainedHours: t.totalRetainedHours / Math.max(1, snapshot.learners.length),
    isDue: t.meanR < CONFIG.recallDueThreshold,
    isAsh: t.meanR < CONFIG.ashThreshold,
    dueCount: t.dueCount,
    kindMinutes: t.kindMinutes,
  }));
}

export function HearthStage({
  snapshot,
  lens,
  selectedTopicId,
  selectedLearnerSub,
  onSelectTopic,
  onSelectLearner,
  forceSvg = false,
}: HearthStageProps) {
  const reducedMotion = useReducedMotion();
  const colors = useThemeColors();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDark = colors.dark;
  const selectedLearner = selectedLearnerSub
    ? snapshot.learners.find((l) => l.learner.personSub === selectedLearnerSub) ?? null
    : null;
  const logs = buildLogDisplays(snapshot, selectedLearner);

  const showCanvasSparks = !forceSvg && !reducedMotion;

  // Animated ember sparks on Canvas (paused when tab hidden or reducedMotion)
  useEffect(() => {
    if (!showCanvasSparks) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let running = !document.hidden;

    type Spark = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number };
    const sparks: Spark[] = [];
    const MAX_SPARKS = 42;

    const spawnSpark = () => {
      const activeIndices = logs
        .map((l, idx) => ({ r: l.r, idx }))
        .filter((item) => item.r >= CONFIG.ashThreshold);
      if (activeIndices.length === 0) return;
      const pick = activeIndices[Math.floor(Math.random() * activeIndices.length)];
      const baseX = 165 + pick.idx * 135;
      sparks.push({
        x: baseX + (Math.random() - 0.5) * 60,
        y: 410 - pick.r * 35,
        vx: (Math.random() - 0.5) * 0.55,
        vy: -(0.7 + Math.random() * 1.3 * pick.r),
        life: 0,
        maxLife: 45 + Math.random() * 50,
        size: 1.3 + Math.random() * 2.1,
      });
    };

    const draw = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (sparks.length < MAX_SPARKS && Math.random() < 0.42) {
        spawnSpark();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx + Math.sin(s.life * 0.12) * 0.25;
        s.y += s.vy;
        s.life += 1;
        const alpha = Math.max(0, 1 - s.life / s.maxLife);
        if (s.life >= s.maxLife) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = isDark
          ? `rgba(255, 186, 92, ${alpha * 0.9})`
          : `rgba(224, 108, 32, ${alpha * 0.85})`;
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    };

    const onVis = () => {
      running = !document.hidden;
      if (running) rafId = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', onVis);
    if (running) rafId = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [showCanvasSparks, logs, isDark]);

  // Palette derived from theme (no raw red+green pairing; warm ember, amber, brass, slate)
  const pal = isDark
    ? {
        bgTop: '#161413',
        bgBot: '#1d1917',
        stone: '#2a2624',
        stoneEdge: '#3b3531',
        stoneLight: '#332e2b',
        firebox: '#120e0c',
        hearthstone: '#24201d',
        grate: '#1a1716',
        brass: '#c99b4a',
        brassDark: '#7a5a22',
        ash: '#7b7570',
        ashLine: '#a39c96',
        emberBright: '#ff9442',
        emberCore: '#ffd28a',
        emberMid: '#d95d24',
        soot: '#e2d8ce',
        label: '#ede6de',
        muted: '#a69d94',
      }
    : {
        bgTop: '#ece6dc',
        bgBot: '#e2d9cc',
        stone: '#d5cbbd',
        stoneEdge: '#bfb3a2',
        stoneLight: '#ded5c8',
        firebox: '#261e1a',
        hearthstone: '#c9beae',
        grate: '#3a322e',
        brass: '#a37528',
        brassDark: '#6e4d17',
        ash: '#8d867e',
        ashLine: '#b8b0a6',
        emberBright: '#e86820',
        emberCore: '#ffbe66',
        emberMid: '#b84214',
        soot: '#4d433b',
        label: '#2c2520',
        muted: '#6b6057',
      };

  const leadTeam = snapshot.teams[0];
  const maxThermometer = 12;
  const thermoRatio = Math.min(1, (leadTeam?.meanRetainedHours ?? 0) / maxThermometer);

  // Soot retention curve points when a learner is selected
  const sootPoints = (() => {
    if (!selectedLearner) return null;
    const focusLog =
      selectedLearner.logs.find((l) => l.topicId === selectedTopicId) ??
      selectedLearner.logs.find((l) => l.memory.hasActivity) ??
      selectedLearner.logs[0];
    if (!focusLog || !focusLog.memory.hasActivity) return null;
    const S = Math.max(1, focusLog.memory.stabilityDays);
    const pts: string[] = [];
    for (let d = 0; d <= 10; d++) {
      const x = 160 + d * 42;
      const rVal = retrievability(d, S);
      const y = 166 - rVal * 72;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return {
      path: pts.join(' '),
      label: `${selectedLearner.learner.personName} · ${focusLog.topicTitle} (S = ${S.toFixed(1)}d)`,
    };
  })();

  return (
    <div
      className="relative flex h-full w-[calc(100%-var(--side-w,0px))] items-center justify-center overflow-hidden px-4 select-none"
      data-testid="hearth-stage"
      data-sparks={showCanvasSparks ? 'active' : 'paused'}
    >
      <div className="relative h-full w-full max-w-[960px] max-h-[680px]">
        <svg
          viewBox="0 0 920 620"
          className="h-full w-full"
          role="img"
          aria-label="The Hearth stone fireplace showing topic logs, retrievability glow, and team retained hours thermometer"
        >
          <defs>
            <linearGradient id="hearth-wall" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pal.bgTop} />
              <stop offset="100%" stopColor={pal.bgBot} />
            </linearGradient>
            <radialGradient id="hearth-glow" cx="50%" cy="72%" r="48%">
              <stop offset="0%" stopColor={pal.emberBright} stopOpacity={isDark ? 0.34 : 0.25} />
              <stop offset="65%" stopColor={pal.emberMid} stopOpacity={isDark ? 0.1 : 0.06} />
              <stop offset="100%" stopColor={pal.firebox} stopOpacity="0" />
            </radialGradient>
            <linearGradient id="brass-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={pal.brassDark} />
              <stop offset="50%" stopColor={pal.brass} />
              <stop offset="100%" stopColor={pal.brassDark} />
            </linearGradient>
          </defs>

          {/* Dusk room backdrop */}
          <rect x="0" y="0" width="920" height="620" fill="url(#hearth-wall)" />

          {/* Chimney breast */}
          <rect
            x="95"
            y="24"
            width="730"
            height="196"
            rx="6"
            fill={pal.stone}
            stroke={pal.stoneEdge}
            strokeWidth="2"
          />
          {/* Subtle stone courses */}
          <line x1="95" y1="88" x2="825" y2="88" stroke={pal.stoneEdge} strokeWidth="1" opacity="0.55" />
          <line x1="95" y1="154" x2="825" y2="154" stroke={pal.stoneEdge} strokeWidth="1" opacity="0.55" />

          {/* Soot retention curve on chimney breast (or sprint summary) */}
          <g>
            <text
              x="128"
              y="56"
              fill={pal.muted}
              fontSize="11"
              fontFamily="var(--font-mono, monospace)"
              letterSpacing="0.08em"
            >
              {sootPoints ? 'SOOT RETENTION CURVE' : 'TEAM HEARTH STANDINGS'}
            </text>

            {sootPoints ? (
              <g data-testid="soot-curve">
                <text x="128" y="76" fill={pal.label} fontSize="13" fontWeight="600">
                  {sootPoints.label}
                </text>
                {/* R = 0.7 due threshold dashed line */}
                <line
                  x1="155"
                  y1={166 - 0.7 * 72}
                  x2="585"
                  y2={166 - 0.7 * 72}
                  stroke={pal.brass}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.7"
                />
                <text x="590" y={170 - 0.7 * 72} fill={pal.brass} fontSize="10" fontFamily="monospace">
                  R=0.70 due
                </text>
                <polyline
                  points={sootPoints.path}
                  fill="none"
                  stroke={pal.soot}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <text x="155" y="182" fill={pal.muted} fontSize="10" fontFamily="monospace">
                  Day 0
                </text>
                <text x="550" y="182" fill={pal.muted} fontSize="10" fontFamily="monospace">
                  +10d
                </text>
                <g
                  className="cursor-pointer"
                  onClick={() => onSelectLearner(null)}
                  role="button"
                  tabIndex={0}
                  aria-label="Clear learner filter"
                >
                  <rect
                    x="510"
                    y="40"
                    width="102"
                    height="24"
                    rx="12"
                    fill={pal.stoneLight}
                    stroke={pal.stoneEdge}
                  />
                  <text x="561" y="56" textAnchor="middle" fill={pal.label} fontSize="11">
                    All learners
                  </text>
                </g>
              </g>
            ) : (
              <g>
                {snapshot.teams.map((t, idx) => (
                  <g key={t.team} transform={`translate(128, ${76 + idx * 36})`}>
                    <text x="0" y="14" fill={pal.label} fontSize="13" fontWeight="600">
                      #{t.rank} {t.team}
                    </text>
                    <text x="120" y="14" fill={pal.muted} fontSize="11" fontFamily="monospace">
                      {t.memberCount} learners · R {(t.meanR * 100).toFixed(0)}%
                    </text>
                    <rect x="278" y="4" width="210" height="10" rx="5" fill={pal.firebox} opacity="0.55" />
                    <rect
                      x="278"
                      y="4"
                      width={Math.max(8, Math.min(210, (t.meanRetainedHours / maxThermometer) * 210))}
                      height="10"
                      rx="5"
                      fill={idx === 0 ? pal.emberBright : pal.brass}
                    />
                    <text
                      x="500"
                      y="14"
                      fill={pal.label}
                      fontSize="12"
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {t.meanRetainedHours.toFixed(2)}h
                    </text>
                  </g>
                ))}
              </g>
            )}
          </g>

          {/* Brass thermometer on chimney breast */}
          <g transform="translate(710, 42)" data-testid="brass-thermometer">
            <rect
              x="0"
              y="0"
              width="86"
              height="160"
              rx="10"
              fill={pal.stoneLight}
              stroke="url(#brass-grad)"
              strokeWidth="2.5"
            />
            <text
              x="43"
              y="19"
              textAnchor="middle"
              fill={pal.brass}
              fontSize="9.5"
              fontFamily="monospace"
              fontWeight="700"
            >
              RETAINED
            </text>
            {/* Tube */}
            <rect x="37" y="28" width="12" height="92" rx="6" fill={pal.firebox} />
            <rect
              x="39"
              y={30 + (1 - thermoRatio) * 88}
              width="8"
              height={Math.max(6, thermoRatio * 88)}
              rx="4"
              fill={pal.emberBright}
            />
            <circle cx="43" cy="124" r="10" fill={pal.emberBright} stroke="url(#brass-grad)" strokeWidth="2" />
            <text
              x="43"
              y="150"
              textAnchor="middle"
              fill={pal.label}
              fontSize="12"
              fontFamily="monospace"
              fontWeight="700"
            >
              {(leadTeam?.meanRetainedHours ?? 0).toFixed(2)}h
            </text>
          </g>

          {/* Mantlepiece */}
          <rect
            x="64"
            y="214"
            width="792"
            height="24"
            rx="4"
            fill={pal.stoneLight}
            stroke={pal.stoneEdge}
            strokeWidth="2"
          />

          {/* Fireplace surround & firebox */}
          <rect x="86" y="238" width="748" height="276" fill={pal.stone} stroke={pal.stoneEdge} strokeWidth="2" />
          <rect x="122" y="256" width="676" height="248" rx="8" fill={pal.firebox} />
          <rect x="122" y="256" width="676" height="248" rx="8" fill="url(#hearth-glow)" />

          {/* Wrought-iron grate */}
          <rect x="138" y="458" width="644" height="10" rx="3" fill={pal.grate} />
          <rect x="165" y="468" width="14" height="26" rx="2" fill={pal.grate} />
          <rect x="741" y="468" width="14" height="26" rx="2" fill={pal.grate} />

          {/* Hearthstone slab */}
          <rect
            x="54"
            y="504"
            width="812"
            height="92"
            rx="6"
            fill={pal.hearthstone}
            stroke={pal.stoneEdge}
            strokeWidth="2"
          />

          {/* Topic logs on the grate */}
          {logs.map((log, idx) => {
            const cx = 192 + idx * 134;
            const isSelected = selectedTopicId === log.topicId;
            const logThickness = 18 + Math.min(1, log.effectiveHours / CONFIG.maxEffectiveHoursPerTopic) * 20;
            const flameHeight = log.isAsh ? 0 : 28 + log.r * 98;
            const logY = 456 - logThickness;

            const logFill = log.isAsh
              ? pal.ash
              : lens === 'due' && log.isDue
                ? pal.brass
                : pal.emberMid;

            const metricText =
              lens === 'retrievability'
                ? `R ${(log.r * 100).toFixed(0)}%`
                : lens === 'retained'
                  ? `${log.retainedHours.toFixed(2)}h`
                  : lens === 'due'
                    ? log.isDue
                      ? `Due (${log.dueCount})`
                      : 'Fresh'
                    : lens === 'kinds'
                      ? `${Math.round(log.kindMinutes.build + log.kindMinutes.teach)}m active`
                      : `${log.retainedHours.toFixed(2)}h avg`;

            return (
              <g
                key={log.topicId}
                data-testid={`hearth-log-${log.topicId}`}
                data-r={log.r.toFixed(2)}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${log.title}, retrievability ${(log.r * 100).toFixed(0)} percent, ${log.retainedHours.toFixed(2)} retained hours`}
                onClick={() => onSelectTopic(isSelected ? null : log.topicId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTopic(isSelected ? null : log.topicId);
                  }
                }}
              >
                {/* Pale ash line on hearthstone for logs faded to ash */}
                {log.isAsh && (
                  <ellipse
                    cx={cx}
                    cy={526}
                    rx="46"
                    ry="5"
                    fill={pal.ashLine}
                    opacity="0.72"
                    data-testid={`ash-line-${log.topicId}`}
                  />
                )}

                {/* Flame tongue (static glow even with reducedMotion) */}
                {!log.isAsh && (
                  <g opacity={0.35 + log.r * 0.65}>
                    <path
                      d={`M ${cx - 28} ${logY + 4} Q ${cx - 18} ${logY - flameHeight * 0.55} ${cx} ${logY - flameHeight} Q ${cx + 18} ${logY - flameHeight * 0.55} ${cx + 28} ${logY + 4} Z`}
                      fill={pal.emberBright}
                    />
                    <path
                      d={`M ${cx - 14} ${logY + 4} Q ${cx - 8} ${logY - flameHeight * 0.4} ${cx} ${logY - flameHeight * 0.68} Q ${cx + 8} ${logY - flameHeight * 0.4} ${cx + 14} ${logY + 4} Z`}
                      fill={pal.emberCore}
                    />
                  </g>
                )}

                {/* Log body */}
                <rect
                  x={cx - 52}
                  y={logY}
                  width="104"
                  height={logThickness}
                  rx={logThickness / 2}
                  fill={logFill}
                  stroke={isSelected ? pal.emberCore : pal.grate}
                  strokeWidth={isSelected ? 3 : 1.5}
                />

                {/* Study kind mix bands when lens === 'kinds' */}
                {lens === 'kinds' && (
                  <g>
                    {(['read', 'watch', 'build', 'teach'] as const).map((k, ki) => {
                      const total =
                        log.kindMinutes.read +
                        log.kindMinutes.watch +
                        log.kindMinutes.build +
                        log.kindMinutes.teach;
                      const share = total > 0 ? log.kindMinutes[k] / total : 0.25;
                      const bandColors = ['#7c8fa6', '#8d867e', '#e86820', '#c99b4a'];
                      return (
                        <rect
                          key={k}
                          x={cx - 42 + ki * 21}
                          y={logY + 4}
                          width={Math.max(4, share * 76)}
                          height={Math.max(4, logThickness - 8)}
                          rx="2"
                          fill={bandColors[ki]}
                          opacity="0.9"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Hearthstone label plaque */}
                <text
                  x={cx}
                  y={550}
                  textAnchor="middle"
                  fill={pal.label}
                  fontSize="11.5"
                  fontWeight={isSelected ? '700' : '600'}
                >
                  {log.title.length > 16 ? `${log.title.slice(0, 15)}…` : log.title}
                </text>
                <text
                  x={cx}
                  y={569}
                  textAnchor="middle"
                  fill={log.isAsh ? pal.muted : pal.emberBright}
                  fontSize="12"
                  fontFamily="var(--font-mono, monospace)"
                  fontWeight="700"
                >
                  {metricText}
                </text>
                <text
                  x={cx}
                  y={584}
                  textAnchor="middle"
                  fill={pal.muted}
                  fontSize="10"
                  fontFamily="var(--font-mono, monospace)"
                >
                  {log.effectiveHours.toFixed(1)}h eff
                </text>
              </g>
            );
          })}
        </svg>

        {/* Canvas spark overlay (only when not reducedMotion and not ?nowebgl) */}
        {showCanvasSparks && (
          <canvas
            ref={canvasRef}
            width={920}
            height={620}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}
