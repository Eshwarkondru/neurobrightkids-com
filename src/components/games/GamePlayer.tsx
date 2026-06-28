import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Trophy, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type GameKey =
  | "mirror"
  | "phonics"
  | "memory"
  | "focus"
  | "math"
  | "shape";

const ROUNDS = 6;

export function GamePlayer({
  open,
  onOpenChange,
  game,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  game: GameKey;
  title: string;
}) {
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<null | "ok" | "no">(null);
  const [saved, setSaved] = useState(false);
  const [sessionSeed, setSessionSeed] = useState(0);

  const reset = () => {
    setRound(0);
    setScore(0);
    setFeedback(null);
    setSaved(false);
    setSessionSeed(Math.floor(Math.random() * 1000));
  };

  useEffect(() => {
    if (open) reset();
  }, [open, game]);

  const onAnswer = (correct: boolean) => {
    if (feedback) return;
    setFeedback(correct ? "ok" : "no");
    if (correct) setScore((s) => s + 1);
    setTimeout(() => {
      setFeedback(null);
      setRound((r) => r + 1);
    }, 650);
  };

  const done = round >= ROUNDS;

  useEffect(() => {
    if (!done || saved) return;
    setSaved(true);
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from("game_sessions").insert({
        user_id: data.user.id,
        child_profile_id: localStorage.getItem("neurolearn_active_child") || null,
        game_key: game,
        score,
        rounds: ROUNDS,
        responses: [],
      });
    });
  }, [done, game, saved, score]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Round {Math.min(round + 1, ROUNDS)} of {ROUNDS} · Score {score}
          </DialogDescription>
        </DialogHeader>
        <Progress value={(Math.min(round, ROUNDS) / ROUNDS) * 100} className="h-1.5" />

        {done ? (
          <div className="py-8 text-center">
            <Trophy className="mx-auto h-12 w-12 text-warning" />
            <div className="mt-3 text-2xl font-bold">
              {score} / {ROUNDS}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {score >= 5 ? "Excellent focus!" : score >= 3 ? "Nice work — keep practicing." : "Keep going, you'll get there!"}
            </p>
            <Button className="mt-5" onClick={reset} variant="hero">
              <RotateCcw className="h-4 w-4" /> Play again
            </Button>
          </div>
        ) : (
          <div className="relative min-h-[260px]">
            <GameRound key={`${game}-${round}`} game={game} round={round} seed={sessionSeed} onAnswer={onAnswer} disabled={feedback !== null} />
            {feedback && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                {feedback === "ok" ? (
                  <CheckCircle2 className="h-20 w-20 text-success drop-shadow-lg" />
                ) : (
                  <XCircle className="h-20 w-20 text-destructive drop-shadow-lg" />
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GameRound({ game, round, seed, onAnswer, disabled }: { game: GameKey; round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  switch (game) {
    case "mirror":
      return <MirrorLetter round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
    case "phonics":
      return <Phonics round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
    case "memory":
      return <MemoryQuest round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
    case "focus":
      return <FocusChallenge round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
    case "math":
      return <MathPuzzle round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
    case "shape":
      return <ShapeRecognition round={round} seed={seed} onAnswer={onAnswer} disabled={disabled} />;
  }
}

const pick = <T,>(a: readonly T[], index: number) => a[index % a.length];

/* ---------- Mirror Letter ---------- */
function MirrorLetter({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const { letter, mirrored } = useMemo(() => {
    const challenges = [
      { letter: "b", mirrored: true },
      { letter: "d", mirrored: false },
      { letter: "p", mirrored: true },
      { letter: "q", mirrored: false },
      { letter: "R", mirrored: true },
      { letter: "F", mirrored: false },
    ];
    return pick(challenges, round + seed);
  }, [round, seed]);
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-sm text-muted-foreground">Is this letter mirrored (backwards)?</p>
      <div
        className="select-none text-9xl font-bold gradient-text"
        style={{ transform: mirrored ? "scaleX(-1)" : "none" }}
      >
        {letter}
      </div>
      <div className="flex gap-3">
        <Button disabled={disabled} onClick={() => onAnswer(mirrored)} variant="hero">Yes, mirrored</Button>
        <Button disabled={disabled} onClick={() => onAnswer(!mirrored)} variant="outline">No, normal</Button>
      </div>
    </div>
  );
}

/* ---------- Phonics ---------- */
function Phonics({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const words = ["cat", "dog", "fish", "bear", "tree", "sun", "moon", "kite", "lamp", "zebra"];
  const { word, options, answer } = useMemo(() => {
    const w = pick(words, round + seed);
    const first = w[0].toUpperCase();
    const distractors = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter((c) => c !== first);
    const opts = [first, distractors[((round + seed) * 3) % distractors.length], distractors[((round + seed) * 5 + 7) % distractors.length]]
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => ((a.charCodeAt(0) + round + seed) % 3) - ((b.charCodeAt(0) + round + seed) % 3));
    return { word: w, options: opts, answer: first };
  }, [round, seed]);
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-sm text-muted-foreground">Which letter does this word start with?</p>
      <div className="text-6xl font-bold gradient-text">{word}</div>
      <div className="flex gap-3">
        {options.map((o) => (
          <Button key={o} disabled={disabled} onClick={() => onAnswer(o === answer)} variant="outline" className="h-14 w-14 text-2xl font-bold">
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Memory Quest ---------- */
function MemoryQuest({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const colors = ["bg-rose-500", "bg-emerald-500", "bg-sky-500", "bg-amber-500"];
  const sequence = useMemo(() => {
    const sequences = [
      [0, 2, 1],
      [3, 1, 0, 2],
      [2, 2, 3, 1],
      [1, 0, 3, 2, 0],
      [0, 3, 1, 1, 2],
      [2, 0, 3, 1, 0],
    ];
    return pick(sequences, round + seed);
  }, [round, seed]);
  const [showIdx, setShowIdx] = useState(0);
  const [phase, setPhase] = useState<"show" | "input">("show");
  const [input, setInput] = useState<number[]>([]);

  useEffect(() => {
    if (phase !== "show") return;
    if (showIdx >= sequence.length) {
      const t = setTimeout(() => setPhase("input"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShowIdx((i) => i + 1), 700);
    return () => clearTimeout(t);
  }, [showIdx, phase, sequence.length]);

  const onTap = (i: number) => {
    const next = [...input, i];
    setInput(next);
    if (sequence[next.length - 1] !== i) return onAnswer(false);
    if (next.length === sequence.length) return onAnswer(true);
  };

  const active = phase === "show" ? sequence[showIdx] : -1;
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-sm text-muted-foreground">
        {phase === "show" ? "Watch the sequence..." : "Now repeat it!"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {colors.map((c, i) => (
          <button
            key={i}
            disabled={disabled || phase === "show"}
            onClick={() => onTap(i)}
            className={`h-24 w-24 rounded-2xl transition ${c} ${active === i ? "scale-110 ring-4 ring-white" : "opacity-60 hover:opacity-100"}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- Focus Challenge ---------- */
function FocusChallenge({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const items = useMemo(() => {
    const shapes = ["●", "■", "▲"];
    const colors = ["text-rose-500", "text-emerald-500", "text-sky-500", "text-amber-500"];
    const arr = Array.from({ length: 12 }, () => ({
      shape: "●",
      color: "text-rose-500",
    }));
    arr.forEach((item, index) => {
      item.shape = shapes[(index + round + seed) % shapes.length];
      item.color = colors[(index * 2 + round + seed) % colors.length];
    });
    arr[((round + seed) * 5 + 2) % 12] = { shape: "★", color: "text-yellow-400" };
    return arr;
  }, [round, seed]);
  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="text-sm text-muted-foreground">Tap the yellow star ★ as fast as you can!</p>
      <div className="grid grid-cols-4 gap-2">
        {items.map((it, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onAnswer(it.shape === "★")}
            className={`h-16 w-16 rounded-xl bg-secondary/60 text-3xl hover:bg-secondary ${it.color}`}
          >
            {it.shape}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Math Puzzle ---------- */
function MathPuzzle({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const { a, b, op, answer, options } = useMemo(() => {
    const problems = [
      { a: 4, b: 3, op: "+" as const },
      { a: 9, b: 5, op: "-" as const },
      { a: 6, b: 2, op: "×" as const },
      { a: 8, b: 4, op: "+" as const },
      { a: 10, b: 7, op: "-" as const },
      { a: 3, b: 5, op: "×" as const },
    ];
    const { a, b, op } = pick(problems, round + seed);
    const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
    const variants = [ans, ans + ((round + seed) % 4) + 1, Math.max(0, ans - ((round + seed) % 5) - 2)];
    const options = Array.from(new Set(variants)).sort((x, y) => ((x + round + seed) % 3) - ((y + round + seed) % 3));
    return { a, b, op, answer: ans, options };
  }, [round, seed]);
  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className="text-sm text-muted-foreground">Solve the problem:</p>
      <div className="text-5xl font-bold gradient-text">{a} {op} {b} = ?</div>
      <div className="flex gap-3">
        {options.map((o) => (
          <Button key={o} disabled={disabled} onClick={() => onAnswer(o === answer)} variant="outline" className="h-14 w-16 text-xl font-bold">
            {o}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Shape Recognition ---------- */
function ShapeRecognition({ round, seed, onAnswer, disabled }: { round: number; seed: number; onAnswer: (c: boolean) => void; disabled: boolean }) {
  const shapes = ["circle", "square", "triangle", "diamond"] as const;
  const { target, grid } = useMemo(() => {
    const t = pick(shapes, round + seed);
    const g = Array.from({ length: 6 }, (_, index) => pick(shapes, index + round + seed + 1));
    g[((round + seed) * 2 + 1) % 6] = t;
    return { target: t, grid: g };
  }, [round, seed]);
  const renderShape = (s: typeof shapes[number]) => {
    const base = "h-12 w-12 mx-auto";
    if (s === "circle") return <div className={`${base} rounded-full bg-primary`} />;
    if (s === "square") return <div className={`${base} bg-purple-500`} />;
    if (s === "triangle") return <div className="mx-auto h-0 w-0 border-l-[24px] border-r-[24px] border-b-[40px] border-l-transparent border-r-transparent border-b-cyan-500" />;
    return <div className={`${base} rotate-45 bg-rose-500`} />;
  };
  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <p className="text-sm text-muted-foreground">Find all shapes matching the target — tap one:</p>
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase text-muted-foreground">Target</span>
        {renderShape(target)}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {grid.map((s, i) => (
          <button
            key={i}
            disabled={disabled}
            onClick={() => onAnswer(s === target)}
            className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary/60 hover:bg-secondary"
          >
            {renderShape(s)}
          </button>
        ))}
      </div>
    </div>
  );
}
