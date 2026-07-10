import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, GraduationCap, Loader2, Search, Share2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher Portal — NeuroLearn AI" }, { name: "description", content: "Classroom analytics, risk monitoring, and downloadable reports for teachers." }] }),
  component: TeacherPortal,
});

type ReportRow = {
  id: string;
  created_at: string;
  child_profile_id: string | null;
  child_name: string;
  child_age: number | null;
  child_grade: string | null;
  highest_disorder: string | null;
  highest_percent: number | null;
  risk_level: string | null;
};

type Student = {
  key: string;
  name: string;
  age: number | null;
  grade: string;
  risk: Severity | "—";
  focus: string;
  trendPct: number;
  latestPercent: number;
  reports: number;
  latestReportId: string;
  latestReportDate: string;
};

function TeacherPortal() {
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [query, setQuery] = useState("");

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
    const { data, error } = await supabase
      .from("reports")
      .select("id, created_at, child_profile_id, child_name, child_age, child_grade, highest_disorder, highest_percent, risk_level")
      .eq("parent_id", u.user.id)
      .order("created_at", { ascending: false });
    if (error) console.error("teacher reports load failed", error);
    setRows((data as ReportRow[]) ?? []);
    setLoading(false);
  }

  const students: Student[] = useMemo(() => {
    // Group reports by child (child_profile_id when present, else child name).
    const map = new Map<string, ReportRow[]>();
    for (const r of rows) {
      const key = r.child_profile_id ?? `name:${r.child_name.toLowerCase()}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, list]) => {
      // list is already sorted DESC by created_at.
      const latest = list[0];
      const prev = list[1];
      const trendPct = prev && typeof prev.highest_percent === "number" && typeof latest.highest_percent === "number"
        ? latest.highest_percent - prev.highest_percent
        : 0;
      return {
        key,
        name: latest.child_name?.trim() || "Unnamed child",
        grade: latest.child_grade || "—",
        risk: (latest.risk_level as Severity) ?? "—",
        focus: latest.highest_disorder ?? "—",
        trendPct,
        latestPercent: latest.highest_percent ?? 0,
        reports: list.length,
      };
    });
  }, [rows]);

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [students, query],
  );

  const atRisk = students.filter((s) => s.risk === "High" || s.risk === "Very High" || s.risk === "Moderate").length;
  const avgTrend = students.length
    ? Math.round(students.reduce((acc, s) => acc + s.trendPct, 0) / students.length)
    : 0;
  const totalReports = rows.length;

  const riskColor = (lv: Student["risk"]) =>
    lv === "—" ? "var(--muted-foreground)" : severityColor(lv as Severity);

  return (
    <SiteLayout>
      <PageHero eyebrow="Teacher portal" title="Your class, at a glance" subtitle="Live view of every assessed child linked to your account." />

      {loading ? (
        <div className="glass-strong rounded-3xl p-10 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading class data…</p>
        </div>
      ) : !signedIn ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <FileText className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">Sign in to see your class</div>
          <Link to="/auth"><Button variant="hero" className="mt-4">Sign in</Button></Link>
        </div>
      ) : students.length === 0 ? (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-primary" />
          <div className="mt-3 text-lg font-semibold">No assessed students yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Have a student complete the assessment to see them here.</p>
          <Link to="/assessment"><Button variant="hero" className="mt-4">Start assessment</Button></Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard label="Students" value={String(students.length)} icon={Users} />
            <StatCard label="At risk" value={String(atRisk)} icon={AlertTriangle} />
            <StatCard label="Avg trend" value={`${avgTrend >= 0 ? "+" : ""}${avgTrend}%`} icon={GraduationCap} />
            <StatCard label="Total reports" value={String(totalReports)} icon={GraduationCap} />
          </div>

          <div className="mt-6 glass-strong rounded-3xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-base font-semibold">Child performance overview</div>
              <div className="ml-auto flex items-center gap-2">
                <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
                    placeholder="Search students"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60">
              <div className="grid grid-cols-[1fr_60px_120px_160px_100px_80px] gap-3 bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <div>Student</div><div>Grade</div><div>Risk</div><div>Focus</div><div>Latest %</div><div>Trend</div>
              </div>
              {filtered.map((s) => {
                const trendStr = `${s.trendPct >= 0 ? "+" : ""}${s.trendPct}%`;
                // trend improvement is a DECREASE in risk %.
                const improving = s.trendPct < 0;
                return (
                  <div key={s.key} className="grid grid-cols-[1fr_60px_120px_160px_100px_80px] items-center gap-3 border-t border-border/40 px-4 py-3 text-sm">
                    <div className="min-w-0 truncate font-medium">{s.name}</div>
                    <div className="text-muted-foreground">{s.grade}</div>
                    <div>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: riskColor(s.risk) }}
                      >
                        {s.risk}
                      </span>
                    </div>
                    <div className="text-muted-foreground">{s.focus}</div>
                    <div className="text-muted-foreground">{s.latestPercent}%</div>
                    <div className={improving ? "text-success" : s.trendPct > 0 ? "text-destructive" : "text-muted-foreground"}>
                      {trendStr}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="border-t border-border/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  No students match "{query}".
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </SiteLayout>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Users }) {
  return (
    <div className="glass-strong rounded-3xl p-5">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}<Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-2 gradient-text text-3xl font-bold">{value}</div>
    </div>
  );
}
