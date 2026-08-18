import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, FileText, Filter, Loader2, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DISORDER_LABEL,
  generateReportPDF,
  severityColor,
  severityFor,
  shareReportPDF,
  type AssessmentResult,
  type Disorder,
  type DisorderResult,
  type Severity,
} from "@/lib/assessment";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — NeuroLearn AI" },
      { name: "description", content: "Personalized cognitive reports generated from your child's assessments." },
    ],
  }),
  component: Reports,
});

type ReportRow = {
  id: string;
  parent_id: string;
  child_profile_id: string | null;
  child_name: string;
  child_age: number | null;
  child_grade: string | null;
  answers: unknown;
  scores: unknown;
  highest_disorder: string | null;
  highest_percent: number | null;
  risk_level: string | null;
  recommendations: unknown;
  therapist: unknown;
  recommended_games: unknown;
  strengths: unknown;
  weaknesses: unknown;
  total_correct: number;
  total_questions: number;
  model_version: string | null;
  threshold_version: string | null;
  inference_engine: string | null;
  created_at: string;
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

function resultFromRow(r: ReportRow): AssessmentResult {
  const rawScores = Array.isArray(r.scores) ? (r.scores as unknown[]) : [];
  const results: DisorderResult[] = rawScores
    .map((raw) => {
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
    })
    .sort((a, b) => b.percent - a.percent);

  const highest: DisorderResult =
    results[0] ?? {
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

function Reports() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

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
      .from("reports")
      .select("*")
      .eq("parent_id", userData.user.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("reports load failed", error);
      toast.error("Could not load reports.");
    }
    setRows((data as ReportRow[]) ?? []);
    setLoading(false);
  }

  const reports = useMemo(() => rows.map((r) => {
    const result = resultFromRow(r);
    return {
      row: r,
      result,
      child: { name: r.child_name?.trim() || "Unnamed child", age: r.child_age, grade: r.child_grade },
      reportId: `RPT-${r.id.slice(0, 6).toUpperCase()}`,
      date: new Date(r.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
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

  const handleShare = async (report: (typeof reports)[number]) => {
    try {
      const outcome = await shareReportPDF({
        reportId: report.reportId,
        child: report.child,
        date: report.date,
        result: report.result,
      });
      toast.success(outcome === "shared" ? "Report shared" : "Sharing unavailable — PDF downloaded instead");
    } catch (err) {
      console.error("pdf share failed", err);
      toast.error("Could not share report. Please try again.");
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
              const open = openId === rep.row.id;
              return (
                <div key={rep.row.id} className="glass-strong rounded-3xl p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{rep.reportId}</div>
                      <div className="mt-1 text-lg font-bold">{rep.child.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {rep.child.age != null ? `Age ${rep.child.age}` : "Age —"} · {rep.child.grade ? `Grade ${rep.child.grade}` : "Grade —"} · {rep.date}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        model {rep.row.model_version ?? "n/a"} · thresholds {rep.row.threshold_version ?? "n/a"}
                        {rep.row.inference_engine ? ` · ${rep.row.inference_engine}` : ""}
                      </div>

                    </div>
                    <div className="flex gap-2">
                      <Button variant="glass" size="sm" onClick={() => setOpenId(open ? null : rep.row.id)}>
                        <FileText className="h-3.5 w-3.5" /> {open ? "Hide" : "View"}
                      </Button>
                      <Button variant="glass" size="sm" onClick={() => void handleShare(rep)}>
                        <Share2 className="h-3.5 w-3.5" /> Share
                      </Button>
                      <Button variant="hero" size="sm" onClick={() => handleDownload(rep)}>
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
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

                  {open && (
                    <div className="mt-5 grid gap-4 rounded-2xl border border-border/60 p-4 sm:grid-cols-2">
                      <DetailBlock title="Strengths" items={rep.result.strengths} />
                      <DetailBlock title="Weaknesses" items={rep.result.weaknesses} />
                      <DetailBlock title="Recommendations" items={rep.result.recommendations} />
                      <DetailBlock title="Therapist suggestions" items={rep.result.therapist} />
                      <div className="sm:col-span-2">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended games</div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {rep.result.recommendedGames.map((g) => (
                            <div key={g.key} className="rounded-xl bg-secondary/40 p-3 text-sm">
                              <div className="font-semibold">{g.name}</div>
                              <div className="text-xs text-muted-foreground">{g.reason}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setOpenId(open ? null : rep.row.id)}
                    className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
                    {open ? "Hide details" : "Show details"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </SiteLayout>
  );
}

function DetailBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it) => (
          <li key={it} className="flex gap-2"><span className="text-primary">•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
