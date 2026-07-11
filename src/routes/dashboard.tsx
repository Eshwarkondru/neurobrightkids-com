import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, FileText, Gamepad2, Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  DISORDER_LABEL,
  resultFromReportRow,
  severityColor,
  type AssessmentResult,
  type Disorder,
} from "@/lib/assessment";
import {
  adjustRisk,
  buildDailyRecommendations,
  GAME_LABEL,
  last7DayBuckets,
  monthlyImprovement,
  skillTrends,
  type GameSessionRow,
} from "@/lib/gameStats";
import type { GameKey } from "@/components/games/GamePlayer";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NeuroLearn AI" }, { name: "description", content: "Daily game-based monitoring, weekly progress, and AI recommendations." }] }),
  component: Dashboard,
});

type ReportRow = Parameters<typeof resultFromReportRow>[0] & {
  id: string;
  created_at: string;
  child_name: string;
  child_age: number | null;
  child_grade: string | null;
};

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [sessions, setSessions] = useState<GameSessionRow[]>([]);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSignedIn(false); setRows([]); setSessions([]); setLoading(false); return; }
    setSignedIn(true);
    const [{ data: reports }, { data: gs }] = await Promise.all([
      supabase.from("reports").select("*").eq("parent_id", u.user.id).order("created_at", { ascending: false }),
      supabase.from("game_sessions").select("id, game_key, score, rounds, responses, created_at").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(500),
    ]);
    setRows((reports as ReportRow[]) ?? []);
    setSessions((gs as GameSessionRow[]) ?? []);
    setLoading(false);
  }

  const latest = rows[0];
  const baseResult: AssessmentResult | null = useMemo(() => (latest ? resultFromReportRow(latest) : null), [latest]);
  const childName = latest?.child_name?.trim() || (latest ? "Unnamed child" : null);

  const trends = useMemo(() => skillTrends(sessions), [sessions]);
  const weekly = useMemo(() => last7DayBuckets(sessions), [sessions]);
  const monthly = useMemo(() => monthlyImprovement(sessions), [sessions]);
  const adjusted = useMemo(
    () => (baseResult ? adjustRisk(baseResult.results, sessions) : null),
    [baseResult, sessions],
  );
  const topDisorder: Disorder | null = adjusted?.adjusted[0]?.disorder ?? baseResult?.highest.disorder ?? null;
  const recs = useMemo(() => buildDailyRecommendations(trends, topDisorder), [trends, topDisorder]);

  return (
    <SiteLayout>
      <PageHero eyebrow="Analytics" title="Cognitive Dashboard" subtitle="Daily game-based monitoring with continuous AI insight." />

      {loading ? (
        <div className="glass-strong rounded-3xl p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading dashboard…</p>
        </div>
      ) : !signedIn ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">Sign in to view your dashboard</div>
          <Link to="/auth"><Button variant="hero" className="mt-4">Sign in</Button></Link>
        </div>
      ) : !latest || !baseResult || !adjusted ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">Complete the initial assessment</div>
          <p className="mt-1 text-sm text-muted-foreground">Once done, daily gameplay drives your progress dashboard.</p>
          <Link to="/assessment"><Button variant="hero" className="mt-4">Start assessment</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Stat label="Games Played" value={String(sessions.length)} icon={Gamepad2} />
            <Stat label="Weekly Sessions" value={String(weekly.reduce((a, w) => a + w.sessions, 0))} icon={Activity} />
            <Stat label="Monthly Improvement" value={`${monthly >= 0 ? "+" : ""}${monthly}%`} icon={monthly >= 0 ? TrendingUp : TrendingDown} color={monthly >= 0 ? "#10b981" : "#ef4444"} />
            <Stat label="Focus Area" value={adjusted.adjusted[0]?.label ?? "—"} icon={AlertTriangle} color={severityColor(adjusted.adjusted[0].severity)} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Weekly Progress · {childName}</div>
                <div className="text-xs text-muted-foreground">Accuracy last 7 days</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weekly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Line type="monotone" dataKey="accuracy" stroke="hsl(217 91% 60%)" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold">Adjusted Risk (baseline vs. gameplay)</div>
                <div className="text-xs text-muted-foreground">{new Date(latest.created_at).toLocaleDateString()}</div>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adjusted.adjusted.map((r) => ({ name: r.label, value: r.percent, sev: r.severity }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {adjusted.adjusted.map((r, i) => <Cell key={i} fill={severityColor(r.severity)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {adjusted.adjusted.map((r) => {
                  const delta = adjusted.deltas[r.disorder];
                  return (
                    <div key={r.disorder} className="flex items-center justify-between rounded-lg bg-secondary/40 px-2 py-1">
                      <span>{r.label}</span>
                      <span className={delta < 0 ? "text-success font-semibold" : delta > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                        {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${delta}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 glass-strong rounded-3xl p-5">
            <div className="mb-3 text-sm font-semibold">Skills Improved</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {trends.map((t) => (
                <div key={t.disorder} className="rounded-2xl bg-secondary/40 p-3">
                  <div className="text-xs uppercase text-muted-foreground">{t.label}</div>
                  <div className="mt-1 text-2xl font-bold">{t.accuracy}%</div>
                  <div className={`text-xs font-semibold ${t.deltaPct > 0 ? "text-success" : t.deltaPct < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {t.gamesPlayed === 0 ? "no data" : `${t.deltaPct >= 0 ? "↑" : "↓"} ${Math.abs(t.deltaPct)}% vs last week`}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{t.gamesPlayed} games</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> AI Recommendations</div>
              <ul className="space-y-2 text-sm">
                {recs.map((r, i) => (
                  <li key={i} className="rounded-xl bg-secondary/40 p-3">
                    <div className="font-semibold">{r.title}</div>
                    <div className="text-xs text-muted-foreground">{r.detail}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Link to="/games"><Button variant="hero" size="sm">Play games</Button></Link>
                <Link to="/reports"><Button variant="outline" size="sm">View reports</Button></Link>
              </div>
            </div>
            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gamepad2 className="h-4 w-4 text-primary" /> Recent Games</div>
              {sessions.length === 0 ? (
                <div className="text-sm text-muted-foreground">No game sessions yet. Play a game to start tracking daily progress.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sessions.slice(0, 6).map((s) => {
                    const acc = s.rounds ? Math.round((s.score / s.rounds) * 100) : 0;
                    return (
                      <li key={s.id} className="flex items-center justify-between rounded-xl bg-secondary/40 p-3">
                        <div>
                          <div className="font-semibold">{GAME_LABEL[s.game_key as GameKey] ?? s.game_key}</div>
                          <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold" style={{ color: acc >= 70 ? "#10b981" : acc >= 40 ? "#f59e0b" : "#ef4444" }}>{acc}%</div>
                          <div className="text-xs text-muted-foreground">{s.score}/{s.rounds}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-6 glass-strong rounded-3xl p-5 text-xs text-muted-foreground">
            Baseline focus disorder from initial assessment: <span className="font-semibold text-foreground">{DISORDER_LABEL[baseResult.highest.disorder]} ({baseResult.highest.percent}%)</span> · Adjusted with recent gameplay above.
          </div>
        </>
      )}
    </SiteLayout>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: string; icon: typeof Activity; color?: string }) {
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 text-2xl font-bold" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}
