import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, FileText, Filter, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — NeuroLearn AI" },
      { name: "description", content: "Personalized cognitive reports generated from your child's assessments." },
    ],
  }),
  component: Reports,
});

type SessionRow = {
  id: string;
  game_key: string;
  score: number;
  rounds: number;
  completed_at: string;
  child_profile_id: string | null;
  child_profiles: { child_name: string; age: number; grade: string | null } | null;
};

const focusFor = (key: string) => {
  switch (key) {
    case "assessment": return "Full Screening";
    case "mirror": return "Dyslexia";
    case "phonics": return "Reading";
    case "memory": return "Working Memory";
    case "focus": return "ADHD";
    case "math": return "Dyscalculia";
    case "shape": return "Visual";
    default: return "General";
  }
};

const riskFrom = (score: number, rounds: number) => {
  const pct = rounds > 0 ? (score / rounds) * 100 : 0;
  if (pct >= 70) return { level: "Low", color: "var(--success)" };
  if (pct >= 40) return { level: "Moderate", color: "var(--warning)" };
  return { level: "High", color: "var(--destructive)" };
};

function Reports() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<SessionRow[]>([]);

  useEffect(() => {
    void load();
    const { data } = supabase.auth.onAuthStateChange(() => void load());
    return () => data.subscription.unsubscribe();
  }, []);

  async function load() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSignedIn(false);
      setRows([]);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    const { data } = await supabase
      .from("game_sessions")
      .select("id, game_key, score, rounds, completed_at, child_profile_id, child_profiles(child_name, age, grade)")
      .eq("user_id", userData.user.id)
      .order("completed_at", { ascending: false });
    setRows((data as SessionRow[]) ?? []);
    setLoading(false);
  }

  const empty = !loading && rows.length === 0;

  return (
    <SiteLayout>
      <PageHero eyebrow="Reports" title="Your personalized reports" subtitle="Every completed assessment generates a fresh report linked to your child's profile." />

      {!signedIn && !loading ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">Sign in to view your reports</div>
          <p className="mt-1 text-sm text-muted-foreground">Reports are private to your account.</p>
          <Link to="/auth"><Button variant="hero" className="mt-4">Sign in</Button></Link>
        </div>
      ) : empty ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">No reports available yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Complete the assessment to generate your first report.</p>
          <Link to="/assessment"><Button variant="hero" className="mt-4">Start assessment</Button></Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Button variant="glass" size="sm"><Filter className="h-3.5 w-3.5" /> {rows.length} report{rows.length === 1 ? "" : "s"}</Button>
            <div className="ml-auto"><Link to="/assessment"><Button variant="hero" size="sm"><Sparkles className="h-3.5 w-3.5" /> New assessment</Button></Link></div>
          </div>
          <div className="glass-strong overflow-hidden rounded-3xl">
            <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_1fr_140px_120px_auto] gap-3 border-b border-border/60 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <div className="hidden sm:block">ID</div><div>Child</div><div className="hidden sm:block">Date</div><div className="hidden sm:block">Focus</div><div className="hidden sm:block">Result</div><div className="text-right">Action</div>
            </div>
            {rows.map((r) => {
              const risk = riskFrom(r.score, r.rounds);
              const date = new Date(r.completed_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
              const child = r.child_profiles?.child_name ?? "You";
              const focus = focusFor(r.game_key);
              return (
                <div key={r.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[140px_1fr_1fr_140px_120px_auto] items-center gap-3 border-b border-border/40 px-5 py-4 last:border-0 hover:bg-secondary/40">
                  <div className="hidden font-mono text-xs text-muted-foreground sm:block">RPT-{r.id.slice(0, 6).toUpperCase()}</div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{child}</div>
                    <div className="text-xs text-muted-foreground sm:hidden">{date} · {focus} · {r.score}/{r.rounds}</div>
                  </div>
                  <div className="hidden text-sm text-muted-foreground sm:block">{date}</div>
                  <div className="hidden text-sm sm:block">{focus}</div>
                  <div className="hidden sm:block"><span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: risk.color }}>{risk.level} · {r.score}/{r.rounds}</span></div>
                  <div className="flex justify-end gap-2">
                    <Link to="/dashboard"><Button variant="glass" size="sm"><FileText className="h-3.5 w-3.5" /> View</Button></Link>
                    <Button variant="hero" size="sm" onClick={() => downloadReport(r, child, focus, risk.level, date)}><Download className="h-3.5 w-3.5" /> PDF</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SiteLayout>
  );
}

function downloadReport(r: SessionRow, child: string, focus: string, risk: string, date: string) {
  const pct = r.rounds > 0 ? Math.round((r.score / r.rounds) * 100) : 0;
  const content = `NeuroLearn AI — Personalized Report\n\nReport: RPT-${r.id.slice(0, 6).toUpperCase()}\nChild: ${child}\nDate: ${date}\nFocus area: ${focus}\nScore: ${r.score} / ${r.rounds} (${pct}%)\nRisk indicator: ${risk}\n\nThis report was generated from a real assessment session on your account.\n`;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `neurolearn-${r.id.slice(0, 6)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
