import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Download, GraduationCap, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/teacher")({
  head: () => ({ meta: [{ title: "Teacher Portal — NeuroLearn AI" }, { name: "description", content: "Classroom analytics, risk monitoring, and downloadable reports for teachers." }] }),
  component: TeacherPortal,
});

const students = [
  { name: "Aarav S.", grade: "3", risk: "Moderate", focus: "Dysgraphia", trend: "+8%" },
  { name: "Maya P.", grade: "4", risk: "Low", focus: "—", trend: "+12%" },
  { name: "Rohit K.", grade: "3", risk: "High", focus: "ADHD", trend: "-3%" },
  { name: "Ananya M.", grade: "5", risk: "Low", focus: "—", trend: "+5%" },
  { name: "Devansh T.", grade: "4", risk: "Moderate", focus: "Dyslexia", trend: "+2%" },
];

const riskColor = (lv: string) => lv === "High" ? "var(--destructive)" : lv === "Moderate" ? "var(--warning)" : "var(--success)";

function TeacherPortal() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Teacher portal" title="Your class, at a glance" subtitle="Monitor risk, celebrate growth, and download reports in seconds." />
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Students", v: "28", icon: Users },
          { l: "At risk", v: "4", icon: AlertTriangle },
          { l: "Avg growth", v: "+14%", icon: GraduationCap },
          { l: "Sessions this week", v: "112", icon: GraduationCap },
        ].map((s)=>(
          <div key={s.l} className="glass-strong rounded-3xl p-5">
            <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}<s.icon className="h-4 w-4 text-primary" /></div>
            <div className="mt-2 gradient-text text-3xl font-bold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 glass-strong rounded-3xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-base font-semibold">Class 3B · Performance overview</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-7 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0" placeholder="Search students" />
            </div>
            <Button variant="hero" size="sm"><Download className="h-3.5 w-3.5" /> Export</Button>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60">
          <div className="grid grid-cols-[1fr_60px_120px_140px_80px] gap-3 bg-secondary/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <div>Student</div><div>Grade</div><div>Risk</div><div>Focus</div><div>Trend</div>
          </div>
          {students.map((s)=>(
            <div key={s.name} className="grid grid-cols-[1fr_60px_120px_140px_80px] items-center gap-3 border-t border-border/40 px-4 py-3 text-sm">
              <div className="min-w-0 truncate font-medium">{s.name}</div>
              <div className="text-muted-foreground">{s.grade}</div>
              <div><span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{background: riskColor(s.risk)}}>{s.risk}</span></div>
              <div className="text-muted-foreground">{s.focus}</div>
              <div className={s.trend.startsWith("-") ? "text-destructive" : "text-success"}>{s.trend}</div>
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
