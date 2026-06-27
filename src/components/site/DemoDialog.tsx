import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Brain, ChartBar, Gamepad2, Pause, Play, Rocket, Sparkles, Target } from "lucide-react";

const steps = [
  { icon: Rocket, title: "Quick onboarding", desc: "Child, parent, or teacher creates a profile in under a minute — no clinical setup required.", color: "from-violet-500 to-fuchsia-500" },
  { icon: Gamepad2, title: "Play 6 mini-games", desc: "Mirror Letters, Phonics, Memory Quest, Focus, Math and Shapes capture rich behavioral signals through play.", color: "from-blue-500 to-cyan-500" },
  { icon: Brain, title: "Transformer analysis", desc: "Sequence models score accuracy, latency, hesitation and stroke dynamics across 5,200+ reference samples.", color: "from-purple-500 to-indigo-500" },
  { icon: Target, title: "Multi-disorder screening", desc: "Unified risk estimates for Dyslexia, Dysgraphia, Dyscalculia and ADHD with confidence intervals.", color: "from-rose-500 to-orange-500" },
  { icon: ChartBar, title: "Live cognitive dashboard", desc: "Attention, memory, reading and engagement trends update in real time with explainable insights.", color: "from-cyan-500 to-emerald-500" },
  { icon: Sparkles, title: "Adaptive learning paths", desc: "Personalized activities, parent strategies and teacher reports — generated automatically.", color: "from-fuchsia-500 to-pink-500" },
];

const STEP_MS = 3200;

export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => { if (open) { setI(0); setPlaying(true); } }, [open]);

  useEffect(() => {
    if (!open || !playing) return;
    const t = setTimeout(() => setI((x) => (x + 1) % steps.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, playing, open]);

  const s = steps[i];
  const Icon = s.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="relative bg-gradient-to-br from-background to-secondary/40 p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-primary" /> Platform demo
            </DialogTitle>
            <DialogDescription>A 20-second tour of NeuroLearn AI.</DialogDescription>
          </DialogHeader>

          <div key={i} className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br ${s.color} text-white shadow-glow`}>
              <Icon className="h-12 w-12" />
            </div>
            <div className="mt-5 text-center">
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Step {i + 1} of {steps.length}</div>
              <h3 className="mt-1 text-2xl font-bold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{s.desc}</p>
            </div>
          </div>

          <Progress value={((i + 1) / steps.length) * 100} className="mt-6 h-1.5" />

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPlaying((p) => !p)}>
                {playing ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Play</>}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setI((x) => (x + 1) % steps.length)}>Next →</Button>
            </div>
            <div className="flex gap-2">
              <Link to="/games" onClick={() => onOpenChange(false)}>
                <Button size="sm" variant="glass"><Gamepad2 className="h-3.5 w-3.5" /> Try a game</Button>
              </Link>
              <Link to="/assessment" onClick={() => onOpenChange(false)}>
                <Button size="sm" variant="hero"><Rocket className="h-3.5 w-3.5" /> Start assessment</Button>
              </Link>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
