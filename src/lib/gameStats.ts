import type { Disorder, DisorderResult, Severity } from "@/lib/assessment";
import { DISORDER_LABEL, severityFor } from "@/lib/assessment";
import type { GameKey } from "@/components/games/GamePlayer";

export const GAME_TO_DISORDER: Record<GameKey, Disorder> = {
  mirror: "dyslexia",
  phonics: "dyslexia",
  focus: "adhd",
  memory: "memory",
  math: "dyscalculia",
  shape: "autism",
};

export const GAME_LABEL: Record<GameKey, string> = {
  mirror: "Mirror Letter",
  phonics: "Phonics",
  focus: "Focus",
  memory: "Memory",
  math: "Math",
  shape: "Shape",
};

export type PerRound = { ms: number; correct: boolean };
export type SessionMetrics = {
  avgResponseMs: number;
  mistakes: number;
  accuracy: number; // 0..1
  focusMs: number;
  sessionMs: number;
  perRound: PerRound[];
};

export type GameSessionRow = {
  id: string;
  game_key: string;
  score: number;
  rounds: number;
  responses: unknown;
  created_at: string;
};

export function readMetrics(row: GameSessionRow): SessionMetrics {
  const r = (row.responses ?? {}) as Partial<SessionMetrics> & { metrics?: Partial<SessionMetrics> };
  const m = r.metrics ?? r;
  const accuracy = row.rounds > 0 ? row.score / row.rounds : 0;
  return {
    avgResponseMs: typeof m.avgResponseMs === "number" ? m.avgResponseMs : 0,
    mistakes: typeof m.mistakes === "number" ? m.mistakes : row.rounds - row.score,
    accuracy: typeof m.accuracy === "number" ? m.accuracy : accuracy,
    focusMs: typeof m.focusMs === "number" ? m.focusMs : 0,
    sessionMs: typeof m.sessionMs === "number" ? m.sessionMs : 0,
    perRound: Array.isArray(m.perRound) ? (m.perRound as PerRound[]) : [],
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export type DailyBucket = { date: string; label: string; accuracy: number; sessions: number };

export function last7DayBuckets(sessions: GameSessionRow[]): DailyBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: DailyBucket[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const key = dayKey(d);
    const dayRows = sessions.filter((s) => dayKey(new Date(s.created_at)) === key);
    const acc = dayRows.length
      ? Math.round(
          (dayRows.reduce((a, s) => a + readMetrics(s).accuracy, 0) / dayRows.length) * 100,
        )
      : 0;
    buckets.push({
      date: key,
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      accuracy: acc,
      sessions: dayRows.length,
    });
  }
  return buckets;
}

export type SkillTrend = {
  disorder: Disorder;
  label: string;
  gamesPlayed: number;
  accuracy: number; // last 7d, %
  deltaPct: number; // vs previous 7d, %
};

function windowAccuracy(rows: GameSessionRow[]): number {
  if (!rows.length) return 0;
  return Math.round((rows.reduce((a, s) => a + readMetrics(s).accuracy, 0) / rows.length) * 100);
}

export function skillTrends(sessions: GameSessionRow[]): SkillTrend[] {
  const now = Date.now();
  const inWindow = (s: GameSessionRow, startAgo: number, endAgo: number) => {
    const t = new Date(s.created_at).getTime();
    return t >= now - startAgo * DAY_MS && t < now - endAgo * DAY_MS;
  };
  const bySkill: Record<Disorder, GameSessionRow[]> = {
    dyslexia: [], adhd: [], autism: [], dyscalculia: [], memory: [],
  };
  for (const s of sessions) {
    const disorder = GAME_TO_DISORDER[s.game_key as GameKey];
    if (disorder) bySkill[disorder].push(s);
  }
  return (Object.keys(bySkill) as Disorder[]).map((d) => {
    const rows = bySkill[d];
    const recent = rows.filter((s) => inWindow(s, 7, 0));
    const prev = rows.filter((s) => inWindow(s, 14, 7));
    const accRecent = windowAccuracy(recent);
    const accPrev = windowAccuracy(prev);
    return {
      disorder: d,
      label: DISORDER_LABEL[d],
      gamesPlayed: rows.length,
      accuracy: accRecent,
      deltaPct: accPrev > 0 ? accRecent - accPrev : recent.length ? Math.max(0, accRecent - 50) : 0,
    };
  });
}

/** Blend baseline assessment risk with recent gameplay accuracy per disorder. */
export function adjustRisk(
  baseResults: DisorderResult[],
  sessions: GameSessionRow[],
): { adjusted: DisorderResult[]; deltas: Record<Disorder, number> } {
  const trends = skillTrends(sessions);
  const trendMap = new Map(trends.map((t) => [t.disorder, t]));
  const deltas = {} as Record<Disorder, number>;
  const adjusted = baseResults.map((r) => {
    const t = trendMap.get(r.disorder);
    let percent = r.percent;
    if (t && t.gamesPlayed > 0) {
      // High accuracy → subtract up to 20 points from risk. Low accuracy → add up to 10.
      const adjustment = Math.round((t.accuracy - 60) * -0.25); // 100%→-10; 60%→0; 0%→+15
      // Trend bonus: improving → extra -5. Declining → +3.
      const trendBonus = t.deltaPct > 5 ? -5 : t.deltaPct < -5 ? 3 : 0;
      percent = Math.max(5, Math.min(95, r.percent + adjustment + trendBonus));
    }
    deltas[r.disorder] = percent - r.percent;
    return { ...r, percent, severity: severityFor(percent) as Severity };
  }).sort((a, b) => b.percent - a.percent);
  return { adjusted, deltas };
}

export type DailyRecommendation = { title: string; detail: string };

export function buildDailyRecommendations(
  trends: SkillTrend[],
  topDisorder: Disorder | null,
): DailyRecommendation[] {
  const recs: DailyRecommendation[] = [];
  const sorted = [...trends].sort((a, b) => b.gamesPlayed - a.gamesPlayed);

  if (topDisorder) {
    const t = trends.find((x) => x.disorder === topDisorder);
    if (!t || t.gamesPlayed === 0) {
      recs.push({
        title: `Start ${DISORDER_LABEL[topDisorder]} practice`,
        detail: `No games played yet for the focus area. Aim for 10 minutes today.`,
      });
    } else if (t.accuracy < 60) {
      recs.push({
        title: `Extra ${DISORDER_LABEL[topDisorder]} practice`,
        detail: `Accuracy is ${t.accuracy}% — play the recommended games for 10 minutes today.`,
      });
    } else if (t.deltaPct >= 5) {
      recs.push({
        title: `Great progress on ${DISORDER_LABEL[topDisorder]}`,
        detail: `Accuracy up ${t.deltaPct}% this week. Increase difficulty by playing longer sessions.`,
      });
    } else {
      recs.push({
        title: `Keep steady on ${DISORDER_LABEL[topDisorder]}`,
        detail: `Continue 10 minutes/day of the recommended games to lock in gains.`,
      });
    }
  }

  const weakest = sorted.filter((t) => t.gamesPlayed > 0 && t.accuracy < 60)[0];
  if (weakest && (!topDisorder || weakest.disorder !== topDisorder)) {
    recs.push({
      title: `Boost ${weakest.label}`,
      detail: `Accuracy is ${weakest.accuracy}%. Add one short session 3×/week.`,
    });
  }

  const improving = sorted.filter((t) => t.deltaPct >= 10)[0];
  if (improving) {
    recs.push({
      title: `${improving.label} improved ${improving.deltaPct}%`,
      detail: `Great trend. Increase difficulty on the next session.`,
    });
  }

  const declining = sorted.filter((t) => t.deltaPct <= -10)[0];
  if (declining) {
    recs.push({
      title: `Attention on ${declining.label}`,
      detail: `Accuracy dropped ${Math.abs(declining.deltaPct)}%. Revisit basics with easier rounds.`,
    });
  }

  const untouched = trends.filter((t) => t.gamesPlayed === 0);
  if (untouched.length && recs.length < 3) {
    recs.push({
      title: `Try a new skill`,
      detail: `Not played yet: ${untouched.map((t) => t.label).join(", ")}. One session unlocks progress tracking.`,
    });
  }

  if (!recs.length) {
    recs.push({
      title: `Play a game today`,
      detail: `Daily play produces the analytics that guide personalized recommendations.`,
    });
  }
  return recs.slice(0, 4);
}

export function monthlyImprovement(sessions: GameSessionRow[]): number {
  const now = Date.now();
  const recent = sessions.filter((s) => new Date(s.created_at).getTime() >= now - 14 * DAY_MS);
  const prev = sessions.filter((s) => {
    const t = new Date(s.created_at).getTime();
    return t < now - 14 * DAY_MS && t >= now - 30 * DAY_MS;
  });
  const a = windowAccuracy(recent);
  const b = windowAccuracy(prev);
  if (!prev.length) return recent.length ? Math.max(0, a - 50) : 0;
  return a - b;
}
