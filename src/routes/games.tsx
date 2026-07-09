import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Brain, Calculator, Eye, Gamepad2, Play, Puzzle, Sparkles, Target, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteLayout, PageHero } from "@/components/site/Layout";
import { GamePlayer, type GameKey } from "@/components/games/GamePlayer";
import { supabase } from "@/integrations/supabase/client";
import { computeAssessment, DISORDER_LABEL, recommendedGamesFor, type Disorder } from "@/lib/assessment";

export const Route = createFileRoute("/games")({
  head: () => ({ meta: [{ title: "Games — NeuroLearn AI" }, { name: "description", content: "Adaptive mini-games recommended from your child's assessment." }] }),
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
  const [topDisorder, setTopDisorder] = useState<Disorder | null>(null);
  const [topPercent, setTopPercent] = useState<number>(0);

  useEffect(() => {
    void (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase
        .from("reports")
        .select("highest_disorder, highest_percent, answers")
        .eq("parent_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      const answers = Array.isArray(data.answers) ? (data.answers as unknown as number[]) : null;
      if (answers && answers.length) {
        const res = computeAssessment(answers);
        setTopDisorder(res.highest.disorder);
        setTopPercent(res.highest.percent);
        return;
      }
      if (data.highest_disorder) {
        const map: Record<string, Disorder> = { Dyslexia: "dyslexia", ADHD: "adhd", Autism: "autism", Dyscalculia: "dyscalculia", "Working Memory": "memory" };
        const d = map[data.highest_disorder];
        if (d) { setTopDisorder(d); setTopPercent(data.highest_percent ?? 0); }
      }
    })();
  }, []);


  const recommended = topDisorder ? recommendedGamesFor(topDisorder).map((r) => r.key) : [];
  const recommendedGames = recommended
    .map((k) => games.find((g) => g.key === k)!)
    .filter(Boolean);
  const otherGames = games.filter((g) => !recommended.includes(g.key));

  const play = (g: { key: GameKey; name: string }) => setActive({ key: g.key, name: g.name });

  return (
    <SiteLayout>
      <PageHero eyebrow="Gamified assessment" title="Play. Learn. Reveal." subtitle="Each game collects behavioral signals to power the AI." />

      {topDisorder ? (
        <div className="mb-6 glass-strong rounded-3xl p-5">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold">Recommended for {DISORDER_LABEL[topDisorder]}</span>
            <span className="text-muted-foreground">· Highest risk indicator {topPercent}%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Based on your latest assessment. Play these first for the biggest impact.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedGames.map((g) => (
              <GameCard key={g.key} g={g} recommended onPlay={() => play(g)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 glass rounded-2xl p-4 text-sm text-muted-foreground">
          <Link to="/assessment" className="font-semibold text-primary hover:underline">Complete an assessment</Link> to get personalized game recommendations.
        </div>
      )}

      {otherGames.length > 0 && (
        <>
          <div className="mb-3 text-sm font-semibold text-muted-foreground">{topDisorder ? "All other games" : "All games"}</div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {otherGames.map((g) => (
              <GameCard key={g.key} g={g} onPlay={() => play(g)} />
            ))}
          </div>
        </>
      )}

      <div className="mt-10 glass rounded-2xl p-4 text-center text-xs text-muted-foreground">
        <Gamepad2 className="mr-1 inline h-3.5 w-3.5 text-primary" /> Tap Play on any card — 6 quick rounds per game.
      </div>

      {active && (
        <GamePlayer open={!!active} onOpenChange={(v) => !v && setActive(null)} game={active.key} title={active.name} />
      )}
    </SiteLayout>
  );
}

function GameCard({ g, recommended, onPlay }: { g: (typeof games)[number]; recommended?: boolean; onPlay: () => void }) {
  return (
    <div className={`glass-strong group rounded-3xl p-6 transition hover:-translate-y-1 hover:shadow-glow ${recommended ? "ring-2 ring-primary/50" : ""}`}>
      <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${g.color} text-white shadow-glow`}>
        <g.icon className="h-7 w-7" />
      </div>
      <div className="flex items-center gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g.tag}</div>
        {recommended && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">Recommended</span>}
      </div>
      <h3 className="mt-1 text-lg font-bold">{g.name}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{g.desc}</p>
      <div className="mt-5 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-warning" /> Earn badges</div>
        <Button variant="hero" size="sm" onClick={onPlay}><Play className="h-3.5 w-3.5" /> Play</Button>
      </div>
    </div>
  );
}
