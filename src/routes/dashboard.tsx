import { createFileRoute } from "@tanstack/react-router";
import { Activity, AlertTriangle, Brain, CheckCircle2, TrendingUp } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — NeuroLearn AI" }, { name: "description", content: "Cognitive analytics dashboard with real-time AI predictions." }] }),
  component: Dashboard,
});

const skills = [
  { name: "Attention", score: 78 },{ name: "Memory", score: 84 },{ name: "Reading", score: 71 },{ name: "Writing", score: 66 },{ name: "Math", score: 80 },
];
const trend = Array.from({length:8}).map((_,i)=>({w:`W${i+1}`, score: 55+i*4+Math.round(Math.sin(i)*3)}));
const sessions = [
  { d: "Mon", min: 12 },{ d: "Tue", min: 18 },{ d: "Wed", min: 9 },{ d: "Thu", min: 22 },{ d: "Fri", min: 14 },{ d: "Sat", min: 25 },{ d: "Sun", min: 17 },
];
const risk = [
  { name: "Dyslexia", value: 32, level: "Low" },
  { name: "Dysgraphia", value: 58, level: "Moderate" },
  { name: "Dyscalculia", value: 22, level: "Low" },
  { name: "ADHD", value: 74, level: "High" },
];
const riskColor = (lv: string) => lv === "High" ? "var(--destructive)" : lv === "Moderate" ? "var(--warning)" : "var(--success)";

function Dashboard() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Analytics" title="Cognitive Dashboard" subtitle="A live view of attention, memory, reading, writing, and math — with explainable AI predictions." />
      <div className="grid gap-4 lg:grid-cols-4">
        {[
          { l: "Attention", v: 78, icon: Activity },
          { l: "Memory", v: 84, icon: Brain },
          { l: "Reading", v: 71, icon: TrendingUp },
          { l: "Confidence", v: 92, icon: CheckCircle2 },
        ].map((s) => (
          <div key={s.l} className="glass-strong rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.l}</div>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 gradient-text text-3xl font-bold">{s.v}%</div>
            <Progress value={s.v} className="mt-3 h-1.5" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card title="Cognitive Growth Trend" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="w" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Area dataKey="score" stroke="var(--primary)" strokeWidth={3} fill="url(#ga)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Skill Radar">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skills}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <Radar dataKey="score" stroke="var(--purple)" fill="var(--purple)" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Engagement Minutes / Day" className="lg:col-span-2">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessions}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="d" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="min" stroke="var(--cyan)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="AI Risk Prediction">
          <div className="space-y-3">
            {risk.map((r) => (
              <div key={r.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs font-semibold" style={{ color: riskColor(r.level) }}>{r.level} · {r.value}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full" style={{ width: `${r.value}%`, background: riskColor(r.level) }} />
                </div>
              </div>
            ))}
            <div className="glass mt-4 rounded-xl p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 text-warning" /> Confidence: 92%. Recommend attention-focused activities daily.
            </div>
          </div>
        </Card>
      </div>

      <Card title="Disorder Probability — Detailed View" className="mt-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={risk}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                {risk.map((e, i) => <Cell key={i} fill={riskColor(e.level)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </SiteLayout>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass-strong rounded-3xl p-5 ${className}`}>
      <div className="mb-3 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}
