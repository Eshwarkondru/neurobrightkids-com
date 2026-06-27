import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, Brain, Calculator, Eye, Gamepad2, Play, Puzzle, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { GamePlayer, type GameKey } from "@/components/games/GamePlayer";

export const Route = createFileRoute("/games")({
  head: () => ({ meta: [{ title: "Games — NeuroLearn AI" }, { name: "description", content: "Six adaptive mini-games measuring cognition through play." }] }),
  component: Games,
});

const games: { key: GameKey; icon: typeof Eye; name: string; desc: string; tag: string; color: string }[] = [
  { key: "mirror",  icon: Eye,        name: "Mirror Letter Challenge", desc: "Spot reversed letters at increasing speeds.", tag: "Dyslexia",       color: "from-violet-500 to-fuchsia-500" },
  { key: "phonics", icon: BookOpen,   name: "Phonics Adventure",       desc: "Match sounds to letters in a story-world.",   tag: "Reading",        color: "from-blue-500 to-cyan-500" },
  { key: "memory",  icon: Brain,      name: "Memory Quest",            desc: "Sequential recall with adaptive span.",       tag: "Working Memory", color: "from-purple-500 to-indigo-500" },
  { key: "focus",   icon: Target,     name: "Focus Challenge",         desc: "Sustained attention with distractors.",       tag: "ADHD",           color: "from-rose-500 to-orange-500" },
  { key: "math",    icon: Calculator, name: "Math Puzzle Arena",       desc: "Quantity, comparison & operation tasks.",     tag: "Dyscalculia",    color: "from-cyan-500 to-emerald-500" },
  { key: "shape",   icon: Puzzle,     name: "Shape Recognition",       desc: "Spatial reasoning under time pressure.",      tag: "Visual",         color: "from-fuchsia-500 to-pink-500" },
];

function Games() {
  const [active, setActive] = useState<{ key: GameKey; name: string } | null>(null);

  return (
    <SiteLayout>
      <PageHero eyebrow="Gamified assessment" title="Play. Learn. Reveal." subtitle="Each game collects behavioral signals — accuracy, latency, hesitation, stroke dynamics — to power the AI." />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {games.map((g) => (
          <div key={g.name} className="glass-strong group rounded-3xl p-6 transition hover:-translate-y-1 hover:shadow-glow">
            <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${g.color} text-white shadow-glow`}>
              <g.icon className="h-7 w-7" />
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g.tag}</div>
            <h3 className="mt-1 text-lg font-bold">{g.name}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
            <div className="mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-warning" /> Earn badges</div>
              <Button variant="hero" size="sm" onClick={() => setActive({ key: g.key, name: g.name })}>
                <Play className="h-3.5 w-3.5" /> Play
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-10 glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
        <Gamepad2 className="mr-1 inline h-3.5 w-3.5 text-primary" /> Tap Play on any card — 6 quick rounds per game.
      </div>

      {active && (
        <GamePlayer
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          game={active.key}
          title={active.name}
        />
      )}
    </SiteLayout>
  );
}
