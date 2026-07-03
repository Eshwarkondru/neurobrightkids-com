import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Brain, Calculator, CheckCircle2, PenTool, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/assessment")({
  head: () => ({ meta: [{ title: "Assessment — NeuroLearn AI" }, { name: "description", content: "Gamified multi-disorder screening assessment for children." }] }),
  component: Assessment,
});

const steps = [
  { key: "reading", icon: BookOpen, title: "Reading & Phonics", q: "Tap the word that matches the sound 'cat'", options: ["bat", "cat", "rat", "hat"], answer: 1 },
  { key: "writing", icon: PenTool, title: "Letter Recognition", q: "Which letter is the mirror of 'b'?", options: ["p", "d", "q", "g"], answer: 1 },
  { key: "math", icon: Calculator, title: "Number Sense", q: "Which group has more dots? ●●●●  vs  ●●●", options: ["Left", "Right", "Same", "Not sure"], answer: 0 },
  { key: "focus", icon: Target, title: "Focus Span", q: "Find the odd one: 🔵 🔵 🔴 🔵", options: ["1st", "2nd", "3rd", "4th"], answer: 2 },
  { key: "memory", icon: Brain, title: "Memory", q: "Earlier we showed: 3, 7, 2. Which sequence was it?", options: ["3,2,7", "7,3,2", "3,7,2", "2,7,3"], answer: 2 },
];

function Assessment() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const done = i >= steps.length;
  const progress = useMemo(() => (i / steps.length) * 100, [i]);

  const select = (idx: number) => {
    setAnswers([...answers, idx]);
    setI(i + 1);
  };

  return (
    <SiteLayout>
      <PageHero eyebrow="Adaptive screening" title="Begin your assessment" subtitle="A short, playful set of tasks. Our AI listens to patterns, not just answers." />
      <div className="mx-auto max-w-2xl">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <Progress value={done ? 100 : progress} className="h-2" />
          <div className="mt-2 text-xs text-muted-foreground">Step {Math.min(i + 1, steps.length)} of {steps.length}</div>
          {!done ? (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="gradient-bg flex h-10 w-10 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
                  {(() => { const Icon = steps[i].icon; return <Icon className="h-5 w-5" />; })()}
                </div>
                <div className="text-sm font-semibold text-muted-foreground">{steps[i].title}</div>
              </div>
              <h2 className="mt-4 text-xl font-bold sm:text-2xl">{steps[i].q}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {steps[i].options.map((o, idx) => (
                  <button key={o} onClick={() => select(idx)} className="glass rounded-2xl p-4 text-left text-base font-medium transition hover:-translate-y-0.5 hover:bg-card hover:shadow-glow">
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 text-center">
              <div className="gradient-bg mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><CheckCircle2 className="h-7 w-7" /></div>
              <h2 className="mt-4 text-2xl font-bold">All done!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Your responses are being analyzed by our transformer model.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link to="/dashboard"><Button variant="hero" size="lg">View results <ArrowRight className="h-4 w-4" /></Button></Link>
                <Button variant="glass" size="lg" onClick={() => { setI(0); setAnswers([]); }}>Restart</Button>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
          <Zap className="mr-1 inline h-3.5 w-3.5 text-primary" /> Demo flow — full assessment includes 6 mini-games & behavioral telemetry.
        </div>
      </div>
    </SiteLayout>
  );
}
