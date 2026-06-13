import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [{ title: "Reports — NeuroLearn AI" }, { name: "description", content: "Downloadable weekly and monthly cognitive reports." }] }),
  component: Reports,
});

const reports = [
  { id: "RPT-024", child: "Aarav S.", week: "Week 24 · Jun 2026", risk: "Moderate", focus: "Dysgraphia", color: "var(--warning)" },
  { id: "RPT-023", child: "Aarav S.", week: "Week 23 · Jun 2026", risk: "Moderate", focus: "Dysgraphia", color: "var(--warning)" },
  { id: "RPT-022", child: "Aarav S.", week: "Week 22 · May 2026", risk: "Low", focus: "General", color: "var(--success)" },
  { id: "RPT-021", child: "Aarav S.", week: "Week 21 · May 2026", risk: "High", focus: "ADHD", color: "var(--destructive)" },
];

function Reports() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Reports" title="Weekly & monthly insights" subtitle="Share progress with educators, clinicians and family — all in one downloadable PDF." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button variant="glass" size="sm"><Filter className="h-3.5 w-3.5" /> All children</Button>
        <Button variant="glass" size="sm"><Filter className="h-3.5 w-3.5" /> All risk levels</Button>
        <div className="ml-auto"><Button variant="hero" size="sm"><Download className="h-3.5 w-3.5" /> Export all</Button></div>
      </div>
      <div className="glass-strong overflow-hidden rounded-3xl">
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[120px_1fr_1fr_120px_120px_auto] gap-3 border-b border-border/60 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <div className="hidden sm:block">ID</div><div>Child</div><div className="hidden sm:block">Period</div><div className="hidden sm:block">Focus</div><div className="hidden sm:block">Risk</div><div className="text-right">Action</div>
        </div>
        {reports.map((r) => (
          <div key={r.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[120px_1fr_1fr_120px_120px_auto] items-center gap-3 border-b border-border/40 px-5 py-4 last:border-0 hover:bg-secondary/40">
            <div className="hidden font-mono text-xs text-muted-foreground sm:block">{r.id}</div>
            <div className="min-w-0">
              <div className="truncate font-medium">{r.child}</div>
              <div className="text-xs text-muted-foreground sm:hidden">{r.week} · {r.focus}</div>
            </div>
            <div className="hidden text-sm text-muted-foreground sm:block">{r.week}</div>
            <div className="hidden text-sm sm:block">{r.focus}</div>
            <div className="hidden sm:block"><span className="rounded-full px-2.5 py-1 text-xs font-semibold text-white" style={{ background: r.color }}>{r.risk}</span></div>
            <div className="flex justify-end gap-2">
              <Button variant="glass" size="sm"><FileText className="h-3.5 w-3.5" /> View</Button>
              <Button variant="hero" size="sm"><Download className="h-3.5 w-3.5" /> PDF</Button>
            </div>
          </div>
        ))}
      </div>
    </SiteLayout>
  );
}
