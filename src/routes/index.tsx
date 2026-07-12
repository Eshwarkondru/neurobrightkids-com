import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity, BookOpen, Brain, Calculator, ChartBar, CheckCircle2, Eye, Gamepad2,
  GraduationCap, Heart, LineChart, Lightbulb, PenTool, Play, Puzzle, Rocket,
  ShieldCheck, Sparkles, Target, Trophy, Users, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, PolarAngleAxis,
  PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import heroAi from "@/assets/hero-ai.png";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SiteLayout } from "@/components/site/Layout";

const DEMO_VIDEO_URL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeuroLearn AI — Early Detection. Personalized Learning. Better Futures." },
      { name: "description", content: "Transformer-assisted adaptive learning and multi-disorder screening for Dyslexia, Dysgraphia, Dyscalculia, and ADHD." },
      { property: "og:title", content: "NeuroLearn AI" },
      { property: "og:description", content: "AI-powered screening and adaptive learning for children." },
    ],
  }),
  component: Home,
});

const disorders = [
  { icon: BookOpen, name: "Dyslexia", color: "from-violet-500 to-fuchsia-500", points: ["Reading difficulties", "Letter confusion", "Phonics problems"] },
  { icon: PenTool, name: "Dysgraphia", color: "from-blue-500 to-cyan-500", points: ["Handwriting difficulties", "Writing speed issues", "Letter formation"] },
  { icon: Calculator, name: "Dyscalculia", color: "from-cyan-500 to-emerald-500", points: ["Number confusion", "Math reasoning gaps", "Quantity sense"] },
  { icon: Zap, name: "ADHD", color: "from-fuchsia-500 to-rose-500", points: ["Attention span issues", "Focus challenges", "Impulse control"] },
];

const features = [
  { icon: Brain, title: "Transformer Behavioral Analytics", desc: "Sequence models analyze interaction patterns for nuanced cognitive signals." },
  { icon: Sparkles, title: "Adaptive Learning Engine", desc: "Difficulty, modality and pacing adapt in real-time to each learner." },
  { icon: Target, title: "Multi-Disorder Prediction", desc: "Unified model screens for Dyslexia, Dysgraphia, Dyscalculia & ADHD." },
  { icon: Activity, title: "Real-Time Risk Assessment", desc: "Live risk indicators with confidence scoring during play." },
  { icon: Rocket, title: "Personalized Learning Paths", desc: "AI-generated plans matched to each child's profile." },
  { icon: LineChart, title: "Cognitive Progress Tracking", desc: "Long-term trends across attention, memory, reading, writing, math." },
  { icon: Lightbulb, title: "Explainable AI Insights", desc: "Transparent reasoning behind every prediction and recommendation." },
  { icon: Users, title: "Parent & Teacher Dashboards", desc: "Role-based portals with progress, alerts, and home strategies." },
];

const games = [
  { icon: Eye, name: "Mirror Letter Challenge", tag: "Dyslexia" },
  { icon: BookOpen, name: "Phonics Adventure", tag: "Reading" },
  { icon: Brain, name: "Memory Quest", tag: "Working Memory" },
  { icon: Target, name: "Focus Challenge", tag: "ADHD" },
  { icon: Calculator, name: "Math Puzzle Arena", tag: "Dyscalculia" },
  { icon: Puzzle, name: "Shape Recognition", tag: "Visual" },
];

const cognitiveData = [
  { name: "Attention", score: 78 },
  { name: "Memory", score: 84 },
  { name: "Reading", score: 71 },
  { name: "Writing", score: 66 },
  { name: "Math", score: 80 },
];
const trendData = [
  { w: "W1", score: 58 }, { w: "W2", score: 63 }, { w: "W3", score: 67 },
  { w: "W4", score: 72 }, { w: "W5", score: 78 }, { w: "W6", score: 82 },
];
const riskData = [
  { name: "Dyslexia", value: 32, level: "Low" },
  { name: "Dysgraphia", value: 58, level: "Moderate" },
  { name: "Dyscalculia", value: 22, level: "Low" },
  { name: "ADHD", value: 74, level: "High" },
];
const riskColor = (lv: string) => lv === "High" ? "var(--destructive)" : lv === "Moderate" ? "var(--warning)" : "var(--success)";

const testimonials = [
  { name: "Dr. Anita Rao", role: "Child Psychologist", quote: "The explainable AI helps me discuss findings with parents in plain language." },
  { name: "Marcus L.", role: "Parent of 8-year-old", quote: "We caught early signs of dysgraphia. The home activities made a real difference." },
  { name: "Ms. Priya S.", role: "Special Educator", quote: "Classroom analytics finally show me which students need a different path." },
];

function Home() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl px-4 py-12 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="animate-fade-up">
            <div className="glass mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Transformer-assisted screening for ages 6–15
            </div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="gradient-text">Early Detection.</span><br />
              Personalized Learning.<br />
              <span className="gradient-text">Better Futures.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              AI-powered multi-disorder screening and adaptive learning platform for children —
              spotting Dyslexia, Dysgraphia, Dyscalculia and ADHD through gamified, research-grade behavioral analytics.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/assessment"><Button variant="hero" size="xl"><Rocket className="h-4 w-4" /> Start Assessment</Button></Link>
              <Button variant="glass" size="xl"><Play className="h-4 w-4" /> Watch Demo</Button>
            </div>
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              {[{n:"4",l:"Disorders"},{n:"6+",l:"Mini-games"},{n:"95%",l:"Avg. recall"}].map((s) => (
                <div key={s.l} className="glass rounded-2xl p-3 text-center">
                  <div className="gradient-text text-2xl font-bold">{s.n}</div>
                  <div className="text-[11px] text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 -z-10 gradient-bg opacity-30 blur-3xl rounded-full animate-pulse-glow" />
            <img src={heroAi} alt="AI brain illustration" width={1280} height={1024} className="animate-float mx-auto w-full max-w-md drop-shadow-2xl" />
            <div className="glass-strong absolute -left-2 top-10 hidden rounded-2xl p-3 sm:block animate-float" style={{animationDelay:"1s"}}>
              <div className="flex items-center gap-2 text-xs"><Brain className="h-4 w-4 text-primary" /> Live cognitive trace</div>
            </div>
            <div className="glass-strong absolute -right-2 bottom-10 hidden rounded-2xl p-3 sm:block animate-float" style={{animationDelay:"2s"}}>
              <div className="flex items-center gap-2 text-xs"><ShieldCheck className="h-4 w-4 text-success" /> Explainable & private</div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <Section id="about" eyebrow="About the platform" title="A research-grade engine wrapped in play">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Brain, t: "AI-based screening", d: "Behavioral signals from mini-games are interpreted by transformer models trained on multi-modal cognitive data." },
            { icon: Sparkles, t: "Adaptive learning", d: "Activities re-shape themselves based on accuracy, latency, and engagement — keeping kids in flow." },
            { icon: ChartBar, t: "Behavioral analytics", d: "Eye-saccade proxies, response curves, and stroke dynamics power transparent insights." },
          ].map((c) => (
            <div key={c.t} className="glass-strong rounded-3xl p-6 hover:-translate-y-1 transition-transform">
              <div className="gradient-bg mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                <c.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* DISORDERS */}
      <Section eyebrow="What we screen for" title="Learning disorders supported">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {disorders.map((d) => (
            <div key={d.name} className="glass-strong group rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-glow">
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${d.color} text-white shadow-glow`}>
                <d.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">{d.name}</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {d.points.map((p) => (
                  <li key={p} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" /> {p}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* AI FEATURES */}
      <Section eyebrow="AI features" title="Built on modern, explainable AI">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-5 transition hover:bg-card/80">
              <f.icon className="h-6 w-6 text-primary" />
              <div className="mt-3 text-sm font-semibold">{f.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* GAMES */}
      <Section eyebrow="Gamified assessment" title="Six mini-games. One unified insight engine.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <div key={g.name} className="glass-strong group flex items-center gap-4 rounded-3xl p-5 transition hover:-translate-y-1">
              <div className="gradient-bg flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                <g.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold">{g.name}</div>
                <div className="text-xs text-muted-foreground">{g.tag}</div>
              </div>
              <Gamepad2 className="ml-auto h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </div>
        <div className="mt-6 text-center">
          <Link to="/games"><Button variant="hero" size="lg">Explore games</Button></Link>
        </div>
      </Section>

      {/* DASHBOARD PREVIEW */}
      <Section eyebrow="Analytics dashboard" title="See growth, not just scores">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="glass-strong rounded-3xl p-5 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">Cognitive Growth Trend</div>
              <span className="text-xs text-success">+24% over 6 weeks</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="w" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={3} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-strong rounded-3xl p-5">
            <div className="mb-3 text-sm font-semibold">Skill Radar</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={cognitiveData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Radar dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="glass-strong rounded-3xl p-5 lg:col-span-3">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">AI Prediction · Disorder Probability</div>
              <div className="flex gap-3 text-xs">
                <Legend2 color="var(--success)" label="Low" />
                <Legend2 color="var(--warning)" label="Moderate" />
                <Legend2 color="var(--destructive)" label="High" />
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                    {riskData.map((e, i) => <Cell key={i} fill={riskColor(e.level)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Section>

      {/* PORTALS */}
      <Section eyebrow="Built for everyone in the circle" title="Parent & Teacher portals">
        <div className="grid gap-4 md:grid-cols-2">
          <PortalCard icon={Heart} title="Parent Dashboard" items={["Weekly reports", "Progress tracking", "Home learning suggestions", "Intervention recommendations"]} cta={{to:"/parent", label:"Open Parent Portal"}} />
          <PortalCard icon={GraduationCap} title="Teacher Dashboard" items={["Student performance overview", "Risk monitoring", "Classroom analytics", "Downloadable PDF reports"]} cta={{to:"/teacher", label:"Open Teacher Portal"}} />
        </div>
      </Section>

      {/* RESEARCH */}
      <Section eyebrow="Research innovation" title="Where it gets technical">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {["Transformer Models","Behavioral Analytics","Adaptive Learning","Explainable AI","Multi-Disorder Screening"].map((p) => (
            <div key={p} className="glass-strong rounded-2xl p-5 text-center">
              <Trophy className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 text-sm font-semibold">{p}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section eyebrow="Loved by clinicians & families" title="What people are saying">
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="glass-strong rounded-3xl p-6">
              <p className="text-sm text-foreground">"{t.quote}"</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="gradient-bg flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-primary-foreground">{t.name[0]}</div>
                <div>
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* CONTACT CTA */}
      <Section eyebrow="Contact" title="Bring NeuroLearn to your school or clinic">
        <div className="glass-strong overflow-hidden rounded-3xl p-8 sm:p-12 text-center">
          <p className="mx-auto max-w-xl text-muted-foreground">Talk to our team about pilots, research partnerships, or school-wide deployments.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/contact"><Button variant="hero" size="xl">Get in touch</Button></Link>
            <Link to="/research"><Button variant="glass" size="xl">Read the research</Button></Link>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}

function Section({ eyebrow, title, children, id }: { eyebrow: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-20 sm:mt-28 animate-fade-up">
      <div className="mb-8 text-center">
        <div className="glass mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-4xl"><span className="gradient-text">{title}</span></h2>
      </div>
      {children}
    </section>
  );
}

function Legend2({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</div>;
}

function PortalCard({ icon: Icon, title, items, cta }: { icon: typeof Heart; title: string; items: string[]; cta: { to: string; label: string } }) {
  return (
    <div className="glass-strong rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <div className="gradient-bg flex h-11 w-11 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><Icon className="h-5 w-5" /></div>
        <h3 className="text-lg font-bold">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => <li key={i} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" /> {i}</li>)}
      </ul>
      <Link to={cta.to} className="mt-5 inline-block"><Button variant="hero">{cta.label}</Button></Link>
    </div>
  );
}
