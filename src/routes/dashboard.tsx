import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, FileText, Gamepad2, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  DISORDER_LABEL,
  severityColor,
  severityFor,
  type AssessmentResult,
  type Disorder,
  type DisorderResult,
  type Severity,
} from "@/lib/assessment";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NeuroLearn AI" }, { name: "description", content: "Your child's cognitive dashboard powered by real assessments." }] }),
  component: Dashboard,
});

type ReportRow = {
  id: string;
  created_at: string;
  child_name: string;
  child_age: number | null;
  child_grade: string | null;
  scores: unknown;
  highest_disorder: string | null;
  highest_percent: number | null;
  risk_level: string | null;
  recommendations: unknown;
  recommended_games: unknown;
  strengths: unknown;
  weaknesses: unknown;
  therapist: unknown;
  total_correct: number;
  total_questions: number;
};

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asGameArray(v: unknown): { key: string; name: string; reason: string }[] {
  return Array.isArray(v)
    ? v.filter(
        (g): g is { key: string; name: string; reason: string } =>
          !!g && typeof (g as { key?: unknown }).key === "string" &&
          typeof (g as { name?: unknown }).name === "string" &&
          typeof (g as { reason?: unknown }).reason === "string",
      )
    : [];
}

function toResult(r: ReportRow): AssessmentResult {
  const rawScores = Array.isArray(r.scores) ? (r.scores as unknown[]) : [];
  const results: DisorderResult[] = rawScores.map((raw) => {
    const item = raw as Partial<DisorderResult> & { disorder?: string; percent?: number };
    const disorder = (item.disorder as Disorder) ?? "memory";
    const percent = typeof item.percent === "number" ? item.percent : 0;
    return {
      disorder,
      label: item.label ?? DISORDER_LABEL[disorder] ?? String(disorder),
      percent,
      severity: (item.severity as Severity) ?? severityFor(percent),
      correct: typeof item.correct === "number" ? item.correct : 0,
      total: typeof item.total === "number" ? item.total : 0,
    };
  }).sort((a, b) => b.percent - a.percent);
  const highest: DisorderResult = results[0] ?? {
    disorder: "memory",
    label: r.highest_disorder ?? "—",
    percent: r.highest_percent ?? 0,
    severity: (r.risk_level as Severity) ?? severityFor(r.highest_percent ?? 0),
    correct: 0,
    total: 0,
  };
  return {
    results,
    highest,
    totalCorrect: r.total_correct,
    totalQuestions: r.total_questions,
    strengths: asStringArray(r.strengths),
    weaknesses: asStringArray(r.weaknesses),
    recommendations: asStringArray(r.recommendations),
    therapist: asStringArray(r.therapist),
    recommendedGames: asGameArray(r.recommended_games),
  };
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setSignedIn(false); setRows([]); setLoading(false); return; }
    setSignedIn(true);
    const { data } = await supabase
      .from("reports")
      .select("id, created_at, child_name, child_age, child_grade, scores, highest_disorder, highest_percent, risk_level, recommendations, recommended_games, strengths, weaknesses, therapist, total_correct, total_questions")
      .eq("parent_id", u.user.id)
      .order("created_at", { ascending: false });
    setRows((data as ReportRow[]) ?? []);
    setLoading(false);
  }

  const latest = rows[0];
  const latestResult = useMemo(() => (latest ? toResult(latest) : null), [latest]);
  const childName = latest?.child_name?.trim() || (latest ? "Unnamed child" : null);

  return (
    <SiteLayout>
      <PageHero eyebrow="Analytics" title="Cognitive Dashboard" subtitle="Live view of your child's most recent assessment." />

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
      ) : !latest || !latestResult ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">No reports available yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Complete the assessment to generate your first report.</p>
          <Link to="/assessment"><Button variant="hero" className="mt-4">Start assessment</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Stat label="Total Assessments" value={String(rows.length)} icon={Activity} />
            <Stat label="Latest Report" value={new Date(latest.created_at).toLocaleDateString()} icon={FileText} />
            <Stat label="Highest Risk" value={latestResult.highest.label} icon={AlertTriangle} color={severityColor(latestResult.highest.severity)} />
            <Stat label="Risk %" value={`${latestResult.highest.percent}%`} icon={TrendingUp} color={severityColor(latestResult.highest.severity)} />
          </div>

          <div className="mt-6 glass-strong rounded-3xl p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Latest report · {childName}</div>
              <div className="text-xs text-muted-foreground">{new Date(latest.created_at).toLocaleString()}</div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latestResult.results.map((r) => ({ name: r.label, value: r.percent, sev: r.severity }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {latestResult.results.map((r, i) => <Cell key={i} fill={severityColor(r.severity)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><Gamepad2 className="h-4 w-4 text-primary" /> Recommended games</div>
              <ul className="space-y-2">
                {latestResult.recommendedGames.map((g) => (
                  <li key={g.key} className="rounded-xl bg-secondary/40 p-3">
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.reason}</div>
                  </li>
                ))}
              </ul>
              <div className="mt-4"><Link to="/games"><Button variant="hero" size="sm">Play games</Button></Link></div>
            </div>
            <div className="glass-strong rounded-3xl p-5">
              <div className="mb-3 text-sm font-semibold">Recommendations</div>
              <ul className="space-y-2 text-sm">
                {latestResult.recommendations.map((r) => (
                  <li key={r} className="flex gap-2"><span className="text-primary">•</span><span>{r}</span></li>
                ))}
              </ul>
            </div>
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
