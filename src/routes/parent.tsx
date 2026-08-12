import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, BookHeart, CalendarCheck, Heart, Home, Lightbulb, Loader2, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { DISORDER_LABEL, recommendedGamesFor, type Disorder } from "@/lib/assessment";
import {
  buildDailyRecommendations,
  last7DayBuckets,
  readMetrics,
  skillTrends,
  type GameSessionRow,
} from "@/lib/gameStats";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Parent Portal — NeuroLearn AI" },
      { name: "description", content: "Weekly reports, home learning suggestions, and intervention recommendations for parents." },
      { property: "og:title", content: "Parent Portal — NeuroLearn AI" },
      { property: "og:description", content: "Track your child's weekly screening progress, alerts and home activities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ParentPortal,
});

const HOME_ACTIVITIES: Record<Disorder, { icon: typeof BookHeart; t: string; d: string }[]> = {
  dyslexia: [
    { icon: BookHeart, t: "Read aloud 10 minutes", d: "Pick a story with rhyming words to support phonemic awareness." },
    { icon: Sparkles, t: "Letter hunt", d: "Find 10 words starting with the same sound around the house." },
    { icon: Home, t: "Sound swap", d: "Change the first sound of a word together: cat → bat → hat." },
  ],
  adhd: [
    { icon: Sparkles, t: "Focus sprint", d: "3 cycles of 5-minute focused drawing with a 1-minute break." },
    { icon: Home, t: "Visual checklist", d: "Draw today's 3 tasks and tick them off together." },
    { icon: CalendarCheck, t: "Movement break", d: "2 minutes of jumping or stretching between activities." },
  ],
  dyscalculia: [
    { icon: Home, t: "Kitchen math game", d: "Sort & count utensils into sets of 5 — supports number sense." },
    { icon: Sparkles, t: "Price compare", d: "Compare two prices while shopping and say which is bigger." },
    { icon: BookHeart, t: "Counting story", d: "Read a counting book and act out each number with objects." },
  ],
  memory: [
    { icon: Sparkles, t: "Sequence recall", d: "Say 3 numbers and ask for them back — grow to 5 over the week." },
    { icon: Home, t: "Shopping list game", d: "Remember 4 items on the way to the shop, no writing." },
    { icon: BookHeart, t: "Story retell", d: "After reading, retell the story in the right order." },
  ],
  autism: [
    { icon: BookHeart, t: "Emotion cards", d: "Name the feeling on 5 face pictures and why they feel it." },
    { icon: CalendarCheck, t: "Visual schedule", d: "Draw the day's routine so transitions are predictable." },
    { icon: Sparkles, t: "Turn-taking play", d: "Play a simple board game focusing on waiting for your turn." },
  ],
};

type ReportRow = {
  id: string;
  created_at: string;
  child_name: string;
  highest_disorder: string | null;
  highest_percent: number | null;
  risk_level: string | null;
  scores: unknown;
};

function disorderFromLabel(label: string | null): Disorder | null {
  if (!label) return null;
  const entry = (Object.keys(DISORDER_LABEL) as Disorder[]).find(
    (d) => DISORDER_LABEL[d].toLowerCase() === label.toLowerCase() || d === label.toLowerCase(),
  );
  return entry ?? null;
}

function ParentPortal() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [sessions, setSessions] = useState<GameSessionRow[]>([]);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSignedIn(false);
      setReport(null);
      setSessions([]);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    const [{ data: reports, error }, { data: gs }] = await Promise.all([
      supabase
        .from("reports")
        .select("id, created_at, child_name, highest_disorder, highest_percent, risk_level, scores")
        .eq("parent_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("game_sessions")
        .select("id, game_key, score, rounds, responses, created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (error) console.error("parent reports load failed", error);
    setReport((reports?.[0] as ReportRow) ?? null);
    setSessions((gs as GameSessionRow[]) ?? []);
    setLoading(false);
  }

  const week = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = sessions.filter((s) => new Date(s.created_at).getTime() >= cutoff);
    const metrics = recent.map(readMetrics);
    const totalMs = metrics.reduce((a, m) => a + (m.sessionMs || 0), 0);
    const accuracy = metrics.length
      ? Math.round((metrics.reduce((a, m) => a + m.accuracy, 0) / metrics.length) * 100)
      : 0;
    const minutes = Math.round(totalMs / 60000);
    return {
      sessions: recent.length,
      timeLabel: minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`,
      accuracy,
      buckets: last7DayBuckets(sessions),
    };
  }, [sessions]);

  const trends = useMemo(() => skillTrends(sessions), [sessions]);
  const focus = disorderFromLabel(report?.highest_disorder ?? null);
  const alerts = useMemo(() => buildDailyRecommendations(trends, focus), [trends, focus]);
  const activities = focus ? HOME_ACTIVITIES[focus] : HOME_ACTIVITIES.dyslexia;

  const dateRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, []);

  if (loading) {
    return (
      <SiteLayout>
        <PageHero eyebrow="Parent portal" title="Stay close to your child's growth" subtitle="Loading your child's real progress…" />
        <div className="glass-strong rounded-3xl p-12 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        </div>
      </SiteLayout>
    );
  }

  if (!signedIn || !report) {
    return (
      <SiteLayout>
        <PageHero eyebrow="Parent portal" title="Stay close to your child's growth" subtitle="Weekly insights, gentle alerts, and at-home activities — designed with you in mind." />
        <div className="glass-strong rounded-3xl p-10 text-center">
          <Heart className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">
            {signedIn ? "No reports available yet" : "Sign in to see your child's progress"}
          </div>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {signedIn
              ? "No reports available yet. Complete the assessment to generate your first report."
              : "Log in with your parent account to view weekly progress, alerts and home activities."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link to={signedIn ? "/assessment" : "/auth"}>
              <Button variant="hero">{signedIn ? "Start assessment" : "Login"}</Button>
            </Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const childName = report.child_name?.trim() || "your child";

  return (
    <SiteLayout>
      <PageHero eyebrow="Parent portal" title="Stay close to your child's growth" subtitle="Weekly insights, gentle alerts, and at-home activities — built from your child's real sessions." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><Heart className="h-5 w-5" /></div>
              <div>
                <div className="text-lg font-bold">This week with {childName}</div>
                <div className="text-xs text-muted-foreground">{dateRange}</div>
              </div>
            </div>
            <Link to="/reports"><Button variant="glass" size="sm">Full report</Button></Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { l: "Sessions", v: String(week.sessions) },
              { l: "Time on task", v: week.timeLabel },
              { l: "Avg accuracy", v: week.sessions ? `${week.accuracy}%` : "—" },
            ].map((s) => (
              <div key={s.l} className="glass rounded-2xl p-4 text-center">
                <div className="gradient-text text-2xl font-bold">{s.v}</div>
                <div className="text-[11px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {trends.map((t) => (
              <div key={t.disorder}>
                <div className="flex justify-between text-sm">
                  <span>{t.label}</span>
                  <span className="text-muted-foreground">
                    {t.gamesPlayed ? `${t.accuracy}%` : "No games yet"}
                  </span>
                </div>
                <Progress value={t.gamesPlayed ? t.accuracy : 0} className="mt-1 h-1.5" />
              </div>
            ))}
          </div>
          {!week.sessions && (
            <p className="mt-4 text-xs text-muted-foreground">
              No game sessions in the last 7 days yet — play a recommended game to fill this in.
            </p>
          )}
        </div>
        <div className="glass-strong rounded-3xl p-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-warning" /> Gentle alerts</div>
          <ul className="mt-3 space-y-3 text-sm">
            {alerts.length ? (
              alerts.map((a) => (
                <li key={a.title} className="glass rounded-2xl p-3"><b>{a.title}.</b> {a.detail}</li>
              ))
            ) : (
              <li className="glass rounded-2xl p-3">No alerts yet — keep practising a few minutes each day.</li>
            )}
          </ul>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold"><span className="gradient-text">Home learning suggestions</span></h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Chosen for {childName}'s focus area: {focus ? DISORDER_LABEL[focus] : "general skills"}.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {activities.map((s) => (
            <div key={s.t} className="glass-strong rounded-3xl p-5">
              <div className="gradient-bg mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><s.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              <Link to="/games"><Button variant="glass" size="sm" className="mt-3"><CalendarCheck className="h-3.5 w-3.5" /> Practise now</Button></Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 glass-strong rounded-3xl p-6">
        <div className="flex items-center gap-3"><Lightbulb className="h-5 w-5 text-warning" /><div className="text-lg font-bold">Intervention recommendations</div></div>
        <p className="mt-2 text-sm text-muted-foreground">
          {focus
            ? `The latest screening puts ${DISORDER_LABEL[focus]} highest at ${report.highest_percent ?? 0}% (${report.risk_level ?? "—"}). A 2-week focus block on ${DISORDER_LABEL[focus]} support is suggested, using: ${recommendedGamesFor(focus).map((g) => g.name).join(", ")}.`
            : "Complete an assessment to receive a personalised intervention plan."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/contact"><Button variant="hero"><MessageCircle className="h-4 w-4" /> Talk to a specialist</Button></Link>
          <Link to="/research"><Button variant="glass">Learn the science</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}
