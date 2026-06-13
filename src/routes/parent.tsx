import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BookHeart, CalendarCheck, Heart, Home, Lightbulb, MessageCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";

export const Route = createFileRoute("/parent")({
  head: () => ({ meta: [{ title: "Parent Portal — NeuroLearn AI" }, { name: "description", content: "Weekly reports, home learning suggestions, and intervention recommendations for parents." }] }),
  component: ParentPortal,
});

const suggestions = [
  { icon: BookHeart, t: "Read aloud 10 minutes", d: "Pick a story with rhyming words to support phonemic awareness." },
  { icon: Home, t: "Kitchen math game", d: "Sort & count utensils into sets of 5 — supports number sense." },
  { icon: Sparkles, t: "Focus sprint", d: "3 cycles of 5-minute focused drawing with a 1-minute break." },
];

function ParentPortal() {
  return (
    <SiteLayout>
      <PageHero eyebrow="Parent portal" title="Stay close to your child's growth" subtitle="Weekly insights, gentle alerts, and at-home activities — designed with you in mind." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass-strong rounded-3xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="gradient-bg flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><Heart className="h-5 w-5" /></div>
              <div>
                <div className="text-lg font-bold">This week with Aarav</div>
                <div className="text-xs text-muted-foreground">June 8 – 14, 2026</div>
              </div>
            </div>
            <Link to="/reports"><Button variant="glass" size="sm">Full report</Button></Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[{l:"Sessions",v:"6"},{l:"Time on task",v:"1h 42m"},{l:"Avg accuracy",v:"81%"}].map(s=>(
              <div key={s.l} className="glass rounded-2xl p-4 text-center">
                <div className="gradient-text text-2xl font-bold">{s.v}</div>
                <div className="text-[11px] text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {[
              { l: "Reading", v: 71 },{ l: "Writing", v: 66 },{ l: "Math", v: 80 },{ l: "Focus", v: 78 },
            ].map((s)=> (
              <div key={s.l}>
                <div className="flex justify-between text-sm"><span>{s.l}</span><span className="text-muted-foreground">{s.v}%</span></div>
                <Progress value={s.v} className="mt-1 h-1.5" />
              </div>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-3xl p-6">
          <div className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-warning" /> Gentle alerts</div>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="glass rounded-2xl p-3"><b>Writing pace</b> dropped 12% this week. Try the kitchen math activity.</li>
            <li className="glass rounded-2xl p-3"><b>Great streak!</b> 4 days of focused practice in a row.</li>
            <li className="glass rounded-2xl p-3"><b>Tip:</b> Schedule sessions before screen time for best results.</li>
          </ul>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-bold"><span className="gradient-text">Home learning suggestions</span></h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {suggestions.map((s)=>(
            <div key={s.t} className="glass-strong rounded-3xl p-5">
              <div className="gradient-bg mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><s.icon className="h-5 w-5" /></div>
              <div className="font-semibold">{s.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              <Button variant="glass" size="sm" className="mt-3"><CalendarCheck className="h-3.5 w-3.5" /> Schedule</Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 glass-strong rounded-3xl p-6">
        <div className="flex items-center gap-3"><Lightbulb className="h-5 w-5 text-warning" /><div className="text-lg font-bold">Intervention recommendations</div></div>
        <p className="mt-2 text-sm text-muted-foreground">Based on this week's patterns, our AI suggests a 2-week focus block emphasizing dysgraphia support with handwriting micro-drills.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="hero"><MessageCircle className="h-4 w-4" /> Talk to a specialist</Button>
          <Link to="/research"><Button variant="glass">Learn the science</Button></Link>
        </div>
      </section>
    </SiteLayout>
  );
}
