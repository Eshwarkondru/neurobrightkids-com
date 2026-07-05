import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Filter, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { computeAssessment, generateReportPDF, severityColor, type AssessmentResult } from "@/lib/assessment";

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
  responses: unknown;
  child_profiles: { child_name: string; age: number; grade: string | null } | null;
};

function resultFromRow(r: SessionRow): AssessmentResult {
  const stored = r.responses as { answers?: number[]; scores?: unknown } | null;
  if (stored?.answers && Array.isArray(stored.answers)) {
    return computeAssessment(stored.answers as number[]);
  }
  return computeAssessment([]);
}

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
      setSignedIn(false); setRows([]); setLoading(false);
      return;
    }
    setSignedIn(true);
    const { data, error } = await supabase
      .from("game_sessions")
      .select("id, game_key, score, rounds, completed_at, child_profile_id, responses, child_profiles(child_name, age, grade)")
      .eq("user_id", userData.user.id)
      .eq("game_key", "assessment")
      .order("completed_at", { ascending: false });
    if (error) console.error("reports load failed", error);
    setRows((data as SessionRow[]) ?? []);
    setLoading(false);
  }

  const reports = useMemo(() => rows.map((r) => {
    const result = resultFromRow(r);
    const child = r.child_profiles;
    const childName = child?.child_name?.trim() || "Unnamed child";
    return {
      row: r,
      result,
      child: { name: childName, age: child?.age ?? null, grade: child?.grade ?? null },
      reportId: `RPT-${r.id.slice(0, 6).toUpperCase()}`,
      date: new Date(r.completed_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    };
  }), [rows]);

  const empty = !loading && reports.length === 0;

  const handleDownload = (report: (typeof reports)[number]) => {
    try {
      generateReportPDF({
        reportId: report.reportId,
        child: report.child,
        date: report.date,
        result: report.result,
      });
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("pdf generation failed", err);
      toast.error("Could not generate PDF. Please try again.");
    }
  };

  return (
    <SiteLayout>
      <PageHero eyebrow="Reports" title="Your personalized reports" subtitle="Every completed assessment generates a fresh report linked to your child's profile." />

      {loading ? (
        <div className="glass-strong rounded-3xl p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading reports…</p>
        </div>
      ) : !signedIn ? (
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
            <Button variant="glass" size="sm"><Filter className="h-3.5 w-3.5" /> {reports.length} report{reports.length === 1 ? "" : "s"}</Button>
            <div className="ml-auto"><Link to="/assessment"><Button variant="hero" size="sm"><Sparkles className="h-3.5 w-3.5" /> New assessment</Button></Link></div>
          </div>

          <div className="grid gap-4">
            {reports.map((rep) => {
              const h = rep.result.highest;
              return (
                <div key={rep.row.id} className="glass-strong rounded-3xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{rep.reportId}</div>
                      <div className="mt-1 text-lg font-bold">{rep.child.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {rep.child.age != null ? `Age ${rep.child.age}` : "Age —"} · {rep.child.grade ? `Grade ${rep.child.grade}` : "Grade —"} · {rep.date}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link to="/dashboard"><Button variant="glass" size="sm"><FileText className="h-3.5 w-3.5" /> View</Button></Link>
                      <Button variant="hero" size="sm" onClick={() => handleDownload(rep)}><Download className="h-3.5 w-3.5" /> PDF</Button>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl bg-secondary/40 p-3 text-sm">
                    <span className="text-muted-foreground">Highest risk:</span>{" "}
                    <span className="font-semibold" style={{ color: severityColor(h.severity) }}>{h.label} · {h.percent}% · {h.severity}</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {rep.result.results.map((r) => (
                      <div key={r.disorder}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{r.label}</span>
                          <span className="font-semibold" style={{ color: severityColor(r.severity) }}>{r.percent}% · {r.severity}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full" style={{ width: `${r.percent}%`, background: severityColor(r.severity) }} />
                        </div>
                      </div>
                    ))}
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
