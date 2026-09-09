import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, RotateCcw, Volume2, ArrowRight, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  EARLY_GAMES,
  EARLY_GAME_METRIC,
  LEVEL_LABEL,
  encouragement,
  loadLevel,
  nextLevel,
  saveLevel,
  type EarlyGameKey,
  type Level,
} from "@/lib/earlyGames";

export type RoundExtra = {
  retries?: number;
  coverage?: number;
  offPath?: number;
  misses?: number;
};

type RoundResult = { ms: number; correct: boolean } & RoundExtra;

type RoundProps = {
  level: Level;
  round: number;
  seed: number;
  disabled: boolean;
  onAnswer: (correct: boolean, extra?: RoundExtra) => void;
};

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function rngFor(seed: number) {
  let t = (seed + 0x6d2b79f5) | 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clampNum = (n: number) => (Number.isFinite(n) ? n : 0);

function BigChoices({
  items,
  disabled,
  onPick,
  className = "",
}: {
  items: { key: string; label: React.ReactNode }[];
  disabled: boolean;
  onPick: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap justify-center gap-3 sm:gap-4 ${className}`}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(it.key)}
          className="flex min-h-[72px] min-w-[72px] items-center justify-center rounded-3xl bg-secondary/60 px-5 text-4xl font-bold shadow-sm transition hover:bg-secondary hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 disabled:opacity-60 sm:min-h-[92px] sm:min-w-[92px] sm:text-5xl"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-base font-semibold text-muted-foreground sm:text-lg">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

export function EarlySkillsPlayer({
  open,
  onOpenChange,
  gameKey,
  onNextGame,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gameKey: EarlyGameKey;
  onNextGame?: () => void;
}) {
  const meta = EARLY_GAMES.find((g) => g.key === gameKey)!;
  const rounds = meta.rounds;

  const [level, setLevel] = useState<Level>(1);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [feedback, setFeedback] = useState<null | "ok" | "no">(null);
  const [seed, setSeed] = useState(1);
  const [roundStart, setRoundStart] = useState(() => Date.now());
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [nextLvl, setNextLvl] = useState<Level>(1);
  const savedRef = useRef(false);

  const start = useCallback(
    (lvl: Level) => {
      const now = Date.now();
      savedRef.current = false;
      setLevel(lvl);
      setRound(0);
      setScore(0);
      setResults([]);
      setFeedback(null);
      setSeed(Math.floor(Math.random() * 100000) + 1);
      setRoundStart(now);
      setSessionStart(now);
      setSaveState("idle");
    },
    [],
  );

  useEffect(() => {
    if (open) start(loadLevel(gameKey));
  }, [open, gameKey, start]);

  useEffect(() => {
    if (open) setRoundStart(Date.now());
  }, [round, open]);

  const done = round >= rounds;

  const onAnswer = (correct: boolean, extra?: RoundExtra) => {
    if (feedback || done) return;
    const ms = Math.max(0, Date.now() - roundStart);
    setResults((r) => [...r, { ms, correct, ...(extra ?? {}) }]);
    setFeedback(correct ? "ok" : "no");
    if (correct) setScore((s) => s + 1);
    window.setTimeout(() => {
      setFeedback(null);
      setRound((r) => r + 1);
    }, 700);
  };

  const accuracy = results.length ? results.filter((r) => r.correct).length / results.length : 0;
  const totalMs = Math.max(0, Date.now() - sessionStart);

  /* persist one session per completion */
  useEffect(() => {
    if (!done || savedRef.current) return;
    savedRef.current = true;
    const finishedAt = new Date();
    const acc = results.length ? results.filter((r) => r.correct).length / results.length : 0;
    const advanced = nextLevel(level, acc);
    setNextLvl(advanced);
    saveLevel(gameKey, advanced);
    setSaveState("saving");

    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          setSaveState("error");
          return;
        }
        let childProfileId: string | null = null;
        const candidate = localStorage.getItem("neurolearn_active_child");
        if (candidate) {
          const { data: owned } = await supabase
            .from("child_profiles")
            .select("id")
            .eq("id", candidate)
            .eq("owner_id", data.user.id)
            .maybeSingle();
          childProfileId = owned?.id ?? null;
          if (!childProfileId) localStorage.removeItem("neurolearn_active_child");
        }

        const correctCount = results.filter((r) => r.correct).length;
        const incorrectCount = results.length - correctCount;
        const retries = results.reduce((a, r) => a + (r.retries ?? 0), 0);
        const misses = results.reduce((a, r) => a + (r.misses ?? 0), 0);
        const traced = results.filter((r) => typeof r.coverage === "number");
        const coverage = traced.length
          ? traced.reduce((a, r) => a + (r.coverage ?? 0), 0) / traced.length
          : null;
        const offPath = results.reduce((a, r) => a + (r.offPath ?? 0), 0);
        const avgResponseMs = results.length
          ? Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length)
          : 0;
        const sessionMs = Math.max(0, finishedAt.getTime() - sessionStart);

        const metrics: Record<string, unknown> = {
          game_family: "early_skills",
          level,
          next_level: advanced,
          score: correctCount,
          correct_count: correctCount,
          incorrect_count: incorrectCount,
          accuracy: clampNum(acc),
          avgResponseMs: clampNum(avgResponseMs),
          response_time: clampNum(avgResponseMs),
          total_time: clampNum(sessionMs),
          sessionMs: clampNum(sessionMs),
          focusMs: clampNum(sessionMs),
          mistakes: incorrectCount,
          retry_count: retries,
          missed_actions: misses,
          completion_status: "completed",
          started_at: new Date(sessionStart).toISOString(),
          completed_at: finishedAt.toISOString(),
          perRound: results,
          [EARLY_GAME_METRIC[gameKey]]: clampNum(coverage ?? acc),
        };
        if (coverage !== null) metrics.stroke_off_path = offPath;

        const { error } = await supabase.from("game_sessions").insert({
          user_id: data.user.id,
          child_profile_id: childProfileId,
          game_key: `early_${gameKey}`,
          score: correctCount,
          rounds,
          responses: { metrics },
        });
        setSaveState(error ? "error" : "saved");
        if (error) console.error("early game session insert failed", error);
      } catch (e) {
        console.error("early game session save failed", e);
        setSaveState("error");
      }
    })();
  }, [done, gameKey, level, results, rounds, sessionStart]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,40rem)] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span aria-hidden>{meta.emoji}</span> {meta.name}
          </DialogTitle>
          <DialogDescription>
            Level {level} · {LEVEL_LABEL[level]} — Round {Math.min(round + 1, rounds)} of {rounds} · ⭐ {score}
          </DialogDescription>
        </DialogHeader>
        <Progress value={(Math.min(round, rounds) / rounds) * 100} className="h-2" />

        {done ? (
          <div className="py-6 text-center">
            <div className="text-5xl" aria-hidden>🏆</div>
            <div className="mt-2 text-3xl font-bold">{encouragement(accuracy)}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="⭐ Score" value={`${score}/${rounds}`} />
              <Stat label="🎯 Accuracy" value={`${Math.round(accuracy * 100)}%`} />
              <Stat label="⏱ Time" value={`${Math.round(totalMs / 1000)}s`} />
              <Stat label="🏆 Level" value={`${nextLvl}`} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {nextLvl > level
                ? `You unlocked Level ${nextLvl} — ${LEVEL_LABEL[nextLvl]}!`
                : `Let's practise Level ${level} once more.`}
            </p>
            {saveState === "error" && (
              <p className="mt-2 text-xs text-muted-foreground">
                We couldn't save this round right now — your play still counted.
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button variant="hero" size="lg" onClick={() => start(nextLvl)}>
                <RotateCcw className="h-4 w-4" /> Play again
              </Button>
              {onNextGame && (
                <Button variant="outline" size="lg" onClick={onNextGame}>
                  Next game <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
                Back to games
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative min-h-[280px]">
            <EarlyRound
              key={`${gameKey}-${level}-${round}-${seed}`}
              gameKey={gameKey}
              level={level}
              round={round}
              seed={seed + round * 31}
              disabled={feedback !== null}
              onAnswer={onAnswer}
            />
            {feedback && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="rounded-3xl bg-background/80 px-6 py-4 text-center shadow-lg backdrop-blur">
                  {feedback === "ok" ? (
                    <>
                      <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
                      <div className="mt-1 text-xl font-bold">Great job!</div>
                    </>
                  ) : (
                    <>
                      <div className="text-5xl" aria-hidden>💛</div>
                      <div className="mt-1 text-xl font-bold">Nice try!</div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function EarlyRound({ gameKey, ...p }: RoundProps & { gameKey: EarlyGameKey }) {
  switch (gameKey) {
    case "letter_match": return <LetterMatch {...p} />;
    case "picture_match": return <PictureMatch {...p} />;
    case "same_diff": return <SameOrDifferent {...p} />;
    case "count_objects": return <CountObjects {...p} />;
    case "number_order": return <NumberOrder {...p} />;
    case "memory_cards": return <MemoryCards {...p} />;
    case "pattern": return <FollowPattern {...p} />;
    case "odd_one": return <OddOne {...p} />;
    case "listen_choose": return <ListenChoose {...p} />;
    case "word_builder": return <WordBuilder {...p} />;
    case "follow_instructions": return <FollowInstructions {...p} />;
    case "trace_shape": return <TraceShape {...p} />;
  }
}

/* ------------------------------------------------------------------ */
/* 1. Letter Match                                                     */
/* ------------------------------------------------------------------ */
const UPPER = "ABCDEFGHJKLMNPRSTUVWXYZ".split("");

function LetterMatch({ level, seed, disabled, onAnswer }: RoundProps) {
  const { target, options, answer } = useMemo(() => {
    const rand = rngFor(seed);
    const t = UPPER[Math.floor(rand() * UPPER.length)];
    const others = shuffle(UPPER.filter((c) => c !== t), rand).slice(0, level === 1 ? 2 : 3);
    const lower = level === 3;
    const opts = shuffle([t, ...others], rand).map((c) => (lower ? c.toLowerCase() : c));
    return { target: t, options: opts, answer: lower ? t.toLowerCase() : t };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>{level === 3 ? "Find the small letter that matches!" : "Find the same letter!"}</Prompt>
      <div className="select-none text-7xl font-bold gradient-text sm:text-8xl">{target}</div>
      <BigChoices items={options.map((o) => ({ key: o, label: o }))} disabled={disabled} onPick={(k) => onAnswer(k === answer)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Picture Match                                                    */
/* ------------------------------------------------------------------ */
const PICTURES = [
  { emoji: "🐱", word: "CAT" },
  { emoji: "🐶", word: "DOG" },
  { emoji: "☀️", word: "SUN" },
  { emoji: "🚌", word: "BUS" },
  { emoji: "🐟", word: "FISH" },
  { emoji: "🌳", word: "TREE" },
  { emoji: "⭐", word: "STAR" },
  { emoji: "🏠", word: "HOUSE" },
  { emoji: "🍎", word: "APPLE" },
  { emoji: "🥛", word: "MILK" },
];

function PictureMatch({ level, seed, disabled, onAnswer }: RoundProps) {
  const { item, options, reverse } = useMemo(() => {
    const rand = rngFor(seed);
    const it = PICTURES[Math.floor(rand() * PICTURES.length)];
    const others = shuffle(PICTURES.filter((p) => p.word !== it.word), rand).slice(0, level === 1 ? 2 : 3);
    return { item: it, options: shuffle([it, ...others], rand), reverse: level === 3 };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>{reverse ? "Which picture is this word?" : "Which word is the picture?"}</Prompt>
      <div className="select-none text-7xl sm:text-8xl" aria-label={reverse ? undefined : item.word}>
        {reverse ? <span className="text-5xl font-bold gradient-text sm:text-6xl">{item.word}</span> : item.emoji}
      </div>
      <BigChoices
        items={options.map((o) => ({
          key: o.word,
          label: reverse ? <span aria-label={o.word}>{o.emoji}</span> : <span className="text-2xl sm:text-3xl">{o.word}</span>,
        }))}
        disabled={disabled}
        onPick={(k) => onAnswer(k === item.word)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. Same or Different                                                */
/* ------------------------------------------------------------------ */
function SameOrDifferent({ level, seed, disabled, onAnswer }: RoundProps) {
  const { left, right, same, leftFlip, rightFlip } = useMemo(() => {
    const rand = rngFor(seed);
    const isSame = rand() < 0.5;
    if (level === 1) {
      const pool = ["A", "B", "C", "M", "S", "T"];
      const a = pool[Math.floor(rand() * pool.length)];
      const b = isSame ? a : shuffle(pool.filter((x) => x !== a), rand)[0];
      return { left: a, right: b, same: isSame, leftFlip: false, rightFlip: false };
    }
    if (level === 2) {
      const pool = ["◼", "◆", "▲", "●"];
      const a = pool[Math.floor(rand() * pool.length)];
      const b = isSame ? a : shuffle(pool.filter((x) => x !== a), rand)[0];
      return { left: a, right: b, same: isSame, leftFlip: false, rightFlip: false };
    }
    const pairs = [["b", "d"], ["p", "q"], ["n", "u"], ["6", "9"]];
    const pair = pairs[Math.floor(rand() * pairs.length)];
    const a = pair[0];
    if (isSame) {
      // same glyph, one of them mirrored to make it a true visual-discrimination probe
      const flip = rand() < 0.5;
      return { left: a, right: a, same: !flip, leftFlip: false, rightFlip: flip };
    }
    return { left: a, right: pair[1], same: false, leftFlip: false, rightFlip: false };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>Same or different?</Prompt>
      <div className="flex items-center gap-8">
        {[{ v: left, f: leftFlip }, { v: right, f: rightFlip }].map((it, i) => (
          <div
            key={i}
            className="select-none text-7xl font-bold gradient-text sm:text-8xl"
            style={{ transform: it.f ? "scaleX(-1)" : undefined }}
          >
            {it.v}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        <Button size="lg" variant="hero" className="h-16 px-8 text-xl" disabled={disabled} onClick={() => onAnswer(same)}>
          Same
        </Button>
        <Button size="lg" variant="outline" className="h-16 px-8 text-xl" disabled={disabled} onClick={() => onAnswer(!same)}>
          Different
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Count the Objects                                                */
/* ------------------------------------------------------------------ */
const COUNT_EMOJI = ["🍎", "⭐", "🐟", "🎈", "🚗", "🌸"];

function CountObjects({ level, seed, disabled, onAnswer }: RoundProps) {
  const { emoji, n, options, scattered } = useMemo(() => {
    const rand = rngFor(seed);
    const max = level === 1 ? 5 : 10;
    const count = 1 + Math.floor(rand() * max);
    const e = COUNT_EMOJI[Math.floor(rand() * COUNT_EMOJI.length)];
    const set = new Set<number>([count]);
    while (set.size < 3) {
      const cand = Math.max(1, count + (Math.floor(rand() * 5) - 2));
      set.add(cand);
    }
    return { emoji: e, n: count, options: shuffle([...set], rand), scattered: level === 3 };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>How many do you see?</Prompt>
      <div className={`flex max-w-[22rem] flex-wrap items-center justify-center gap-2 text-4xl sm:text-5xl ${scattered ? "gap-x-6" : ""}`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} aria-hidden style={scattered ? { transform: `translateY(${(i % 3) * 10 - 10}px)` } : undefined}>
            {emoji}
          </span>
        ))}
      </div>
      <BigChoices items={options.map((o) => ({ key: String(o), label: o }))} disabled={disabled} onPick={(k) => onAnswer(Number(k) === n)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Number Order                                                     */
/* ------------------------------------------------------------------ */
function NumberOrder({ level, seed, disabled, onAnswer }: RoundProps) {
  const { seq, missingIdx, answer, options } = useMemo(() => {
    const rand = rngFor(seed);
    const step = level === 3 ? (rand() < 0.5 ? 2 : 1) : 1;
    const maxStart = level === 1 ? 2 : 6;
    const startAt = 1 + Math.floor(rand() * maxStart);
    const s = [0, 1, 2, 3].map((i) => startAt + i * step);
    const idx = 1 + Math.floor(rand() * 2);
    const ans = s[idx];
    const set = new Set<number>([ans]);
    while (set.size < 3) set.add(Math.max(1, ans + (Math.floor(rand() * 5) - 2)));
    return { seq: s, missingIdx: idx, answer: ans, options: shuffle([...set], rand) };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>Which number is missing?</Prompt>
      <div className="flex items-center gap-3 text-5xl font-bold sm:gap-5 sm:text-6xl">
        {seq.map((n, i) => (
          <span key={i} className={i === missingIdx ? "text-primary" : "gradient-text"}>
            {i === missingIdx ? "?" : n}
          </span>
        ))}
      </div>
      <BigChoices items={options.map((o) => ({ key: String(o), label: o }))} disabled={disabled} onPick={(k) => onAnswer(Number(k) === answer)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. Memory Cards                                                     */
/* ------------------------------------------------------------------ */
const CARD_FACES = ["⭐", "🍎", "🐶", "🚗", "🌸", "🐟"];

function MemoryCards({ level, seed, disabled, onAnswer }: RoundProps) {
  const pairs = level + 1; // 2, 3, 4 pairs
  const cards = useMemo(() => {
    const rand = rngFor(seed);
    const faces = shuffle(CARD_FACES, rand).slice(0, pairs);
    return shuffle([...faces, ...faces], rand).map((face, i) => ({ id: i, face }));
  }, [pairs, seed]);

  const [phase, setPhase] = useState<"preview" | "play">("preview");
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const finished = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("play"), 1200 + pairs * 600);
    return () => window.clearTimeout(t);
  }, [pairs]);

  useEffect(() => {
    if (open.length < 2) return;
    const [a, b] = open;
    const isMatch = cards[a].face === cards[b].face;
    const t = window.setTimeout(() => {
      if (isMatch) setMatched((m) => [...m, a, b]);
      else setWrong((w) => w + 1);
      setOpen([]);
    }, 650);
    return () => window.clearTimeout(t);
  }, [open, cards]);

  useEffect(() => {
    if (finished.current || matched.length < cards.length) return;
    finished.current = true;
    const t = window.setTimeout(() => onAnswer(wrong <= pairs, { retries: wrong, misses: wrong }), 350);
    return () => window.clearTimeout(t);
  }, [matched, cards.length, wrong, pairs, onAnswer]);

  const flip = (i: number) => {
    if (phase !== "play" || disabled) return;
    if (open.length >= 2 || open.includes(i) || matched.includes(i)) return;
    setOpen((o) => [...o, i]);
  };

  const faceUp = (i: number) => phase === "preview" || open.includes(i) || matched.includes(i);

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <Prompt>{phase === "preview" ? "Remember the cards..." : "Match the pairs!"}</Prompt>
      <div className="grid grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <button
            key={c.id}
            type="button"
            onClick={() => flip(i)}
            aria-label={faceUp(i) ? c.face : "hidden card"}
            className={`flex h-20 w-20 items-center justify-center rounded-2xl text-4xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 ${
              faceUp(i) ? "bg-secondary" : "bg-primary/20 hover:bg-primary/30"
            } ${matched.includes(i) ? "opacity-50" : ""}`}
          >
            {faceUp(i) ? c.face : "❓"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Follow the Pattern                                               */
/* ------------------------------------------------------------------ */
function FollowPattern({ level, seed, disabled, onAnswer }: RoundProps) {
  const { shown, answer, options } = useMemo(() => {
    const rand = rngFor(seed);
    const pool = level === 3 ? ["◼", "▲", "●", "◆"] : ["🔴", "🔵", "🟢", "🟡"];
    const picked = shuffle(pool, rand);
    const base = level === 1 ? picked.slice(0, 2) : picked.slice(0, 3);
    const seq: string[] = [];
    for (let i = 0; i < base.length * 2 + 1; i++) seq.push(base[i % base.length]);
    const ans = base[seq.length % base.length];
    const distract = shuffle(pool.filter((p) => p !== ans), rand).slice(0, 2);
    return { shown: seq, answer: ans, options: shuffle([ans, ...distract], rand) };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>What comes next?</Prompt>
      <div className="flex flex-wrap items-center justify-center gap-2 text-4xl sm:text-5xl">
        {shown.map((s, i) => (
          <span key={i} aria-hidden>{s}</span>
        ))}
        <span className="text-primary">?</span>
      </div>
      <BigChoices items={options.map((o) => ({ key: o, label: o }))} disabled={disabled} onPick={(k) => onAnswer(k === answer)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Find the Odd One                                                 */
/* ------------------------------------------------------------------ */
function OddOne({ level, seed, disabled, onAnswer }: RoundProps) {
  const { items, oddIdx } = useMemo(() => {
    const rand = rngFor(seed);
    const sets =
      level === 1
        ? [["⭐", "❤️"], ["🍎", "🚗"], ["🐶", "🌸"]]
        : level === 2
          ? [["◼", "◆"], ["●", "◍"], ["▲", "▴"]]
          : [["b", "d"], ["p", "q"], ["6", "9"], ["m", "n"]];
    const [common, odd] = sets[Math.floor(rand() * sets.length)];
    const arr = [common, common, common, common];
    const idx = Math.floor(rand() * 4);
    arr[idx] = odd;
    return { items: arr, oddIdx: idx };
  }, [level, seed]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>Tap the different one!</Prompt>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {items.map((it, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(i === oddIdx)}
            className="flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/60 text-5xl transition hover:bg-secondary hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
          >
            {it}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 9. Listen and Choose                                                */
/* ------------------------------------------------------------------ */
const SPOKEN = ["cat", "dog", "sun", "bus", "fish", "cup", "hat", "pen", "bat", "map"];

function speak(word: string): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.rate = 0.75;
    u.pitch = 1.1;
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

function ListenChoose({ level, seed, disabled, onAnswer }: RoundProps) {
  const { word, options } = useMemo(() => {
    const rand = rngFor(seed);
    const w = SPOKEN[Math.floor(rand() * SPOKEN.length)];
    const pool = level === 3 ? SPOKEN.filter((x) => x !== w && x[0] === w[0]) : SPOKEN.filter((x) => x !== w);
    const others = shuffle(pool.length >= 2 ? pool : SPOKEN.filter((x) => x !== w), rand).slice(0, level === 1 ? 2 : 3);
    return { word: w, options: shuffle([w, ...others], rand) };
  }, [level, seed]);

  const [replays, setReplays] = useState(0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const ok = speak(word);
    setSupported(ok);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [word]);

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>Listen, then tap the word you hear!</Prompt>
      <Button
        size="lg"
        variant="hero"
        className="h-20 w-20 rounded-full p-0"
        onClick={() => {
          setReplays((r) => r + 1);
          setSupported(speak(word));
        }}
        aria-label="Play the word again"
      >
        <Volume2 className="h-9 w-9" />
      </Button>
      {!supported && (
        <p className="text-center text-sm text-muted-foreground">
          Sound isn't available on this device — the word is <strong>{word.toUpperCase()}</strong>.
        </p>
      )}
      <BigChoices
        items={options.map((o) => ({ key: o, label: <span className="text-2xl sm:text-3xl">{o.toUpperCase()}</span> }))}
        disabled={disabled}
        onPick={(k) => onAnswer(k === word, { retries: replays })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10. Word Builder                                                    */
/* ------------------------------------------------------------------ */
const BUILD_WORDS = [
  { emoji: "🐱", word: "CAT" },
  { emoji: "🐶", word: "DOG" },
  { emoji: "☀️", word: "SUN" },
  { emoji: "🦇", word: "BAT" },
  { emoji: "🥤", word: "CUP" },
  { emoji: "🎩", word: "HAT" },
  { emoji: "🐟", word: "FISH" },
  { emoji: "⭐", word: "STAR" },
];

function WordBuilder({ level, seed, disabled, onAnswer }: RoundProps) {
  const { item, letters } = useMemo(() => {
    const rand = rngFor(seed);
    const pool = level === 1 ? BUILD_WORDS.filter((w) => w.word.length === 3) : BUILD_WORDS;
    const it = pool[Math.floor(rand() * pool.length)];
    const extra = level === 3 ? shuffle("BCDFGKLMPRST".split("").filter((c) => !it.word.includes(c)), rand).slice(0, 1) : [];
    return { item: it, letters: shuffle([...it.word.split(""), ...extra], rand) };
  }, [level, seed]);

  const [built, setBuilt] = useState("");
  const [wrong, setWrong] = useState(0);
  const settled = useRef(false);

  const tap = (idx: number, ch: string) => {
    if (disabled || settled.current) return;
    const expected = item.word[built.length];
    if (ch !== expected) {
      setWrong((w) => w + 1);
      return;
    }
    const next = built + ch;
    setBuilt(next);
    if (next === item.word) {
      settled.current = true;
      onAnswer(wrong <= 1, { retries: wrong, misses: wrong });
    }
    void idx;
  };

  const used = (() => {
    const need = built.split("");
    return (ch: string, i: number) => {
      let count = 0;
      for (let k = 0; k < i; k++) if (letters[k] === ch) count++;
      const totalNeeded = need.filter((c) => c === ch).length;
      return count < totalNeeded;
    };
  })();

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <Prompt>Tap the letters to build the word!</Prompt>
      <div className="text-6xl sm:text-7xl" aria-label={item.word}>{item.emoji}</div>
      <div className="flex gap-2">
        {item.word.split("").map((_, i) => (
          <div
            key={i}
            className="flex h-14 w-12 items-center justify-center rounded-xl border-2 border-dashed border-primary/40 text-3xl font-bold"
          >
            {built[i] ?? ""}
          </div>
        ))}
      </div>
      <BigChoices
        items={letters.map((l, i) => ({ key: `${l}-${i}`, label: <span className={used(l, i) ? "opacity-30" : ""}>{l}</span> }))}
        disabled={disabled}
        onPick={(k) => {
          const [ch, idx] = k.split("-");
          tap(Number(idx), ch);
        }}
      />
      {wrong > 0 && <p className="text-sm text-muted-foreground">Let's try again! 💛</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 11. Follow the Instructions                                         */
/* ------------------------------------------------------------------ */
const COLOR_ITEMS = [
  { key: "red-star", color: "red", shape: "star", emoji: "⭐", cls: "text-red-500" },
  { key: "blue-star", color: "blue", shape: "star", emoji: "⭐", cls: "text-blue-500" },
  { key: "green-star", color: "green", shape: "star", emoji: "⭐", cls: "text-green-500" },
  { key: "red-circle", color: "red", shape: "circle", emoji: "●", cls: "text-red-500" },
  { key: "blue-circle", color: "blue", shape: "circle", emoji: "●", cls: "text-blue-500" },
  { key: "green-circle", color: "green", shape: "circle", emoji: "●", cls: "text-green-500" },
];

function FollowInstructions({ level, seed, disabled, onAnswer }: RoundProps) {
  const { grid, targets } = useMemo(() => {
    const rand = rngFor(seed);
    const g = shuffle(COLOR_ITEMS, rand).slice(0, level === 1 ? 3 : 6);
    const count = level === 3 ? 2 : 1;
    const t = shuffle(g, rand).slice(0, count);
    return { grid: g, targets: t };
  }, [level, seed]);

  const [step, setStep] = useState(0);
  const [misses, setMisses] = useState(0);
  const settled = useRef(false);

  const tap = (key: string) => {
    if (disabled || settled.current) return;
    if (key === targets[step].key) {
      const next = step + 1;
      if (next >= targets.length) {
        settled.current = true;
        onAnswer(misses === 0, { misses, retries: misses });
        return;
      }
      setStep(next);
    } else {
      setMisses((m) => m + 1);
      if (misses + 1 >= 3) {
        settled.current = true;
        onAnswer(false, { misses: misses + 1, retries: misses + 1 });
      }
    }
  };

  const instruction = targets
    .map((t, i) => `${i === 0 ? "Tap the" : "then the"} ${t.color} ${t.shape}`)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <Prompt>{instruction}!</Prompt>
      {targets.length > 1 && (
        <p className="text-sm text-muted-foreground">
          Now: {targets[step].color} {targets[step].shape}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4">
        {grid.map((g) => (
          <button
            key={g.key}
            type="button"
            disabled={disabled}
            onClick={() => tap(g.key)}
            aria-label={`${g.color} ${g.shape}`}
            className={`flex h-24 w-24 items-center justify-center rounded-3xl bg-secondary/60 text-5xl transition hover:bg-secondary hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 ${g.cls}`}
          >
            {g.emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 12. Trace the Shape                                                 */
/* ------------------------------------------------------------------ */
type Pt = { x: number; y: number };

const W = 300;
const H = 220;

function shapePath(kind: string): Pt[] {
  const pts: Pt[] = [];
  const push = (x: number, y: number) => pts.push({ x, y });
  if (kind === "circle") {
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      push(150 + 80 * Math.cos(a), 110 + 80 * Math.sin(a));
    }
  } else if (kind === "square") {
    const c = [{ x: 70, y: 40 }, { x: 230, y: 40 }, { x: 230, y: 180 }, { x: 70, y: 180 }, { x: 70, y: 40 }];
    for (let s = 0; s < c.length - 1; s++)
      for (let i = 0; i <= 20; i++)
        push(c[s].x + ((c[s + 1].x - c[s].x) * i) / 20, c[s].y + ((c[s + 1].y - c[s].y) * i) / 20);
  } else if (kind === "triangle") {
    const c = [{ x: 150, y: 35 }, { x: 240, y: 185 }, { x: 60, y: 185 }, { x: 150, y: 35 }];
    for (let s = 0; s < c.length - 1; s++)
      for (let i = 0; i <= 24; i++)
        push(c[s].x + ((c[s + 1].x - c[s].x) * i) / 24, c[s].y + ((c[s + 1].y - c[s].y) * i) / 24);
  } else if (kind === "line") {
    for (let i = 0; i <= 60; i++) push(40 + (220 * i) / 60, 110);
  } else {
    const c = [{ x: 40, y: 170 }, { x: 100, y: 50 }, { x: 160, y: 170 }, { x: 220, y: 50 }, { x: 265, y: 170 }];
    for (let s = 0; s < c.length - 1; s++)
      for (let i = 0; i <= 20; i++)
        push(c[s].x + ((c[s + 1].x - c[s].x) * i) / 20, c[s].y + ((c[s + 1].y - c[s].y) * i) / 20);
  }
  return pts;
}

function TraceShape({ level, seed, disabled, onAnswer }: RoundProps) {
  const kind = useMemo(() => {
    const rand = rngFor(seed);
    const pool = level === 1 ? ["line", "circle"] : level === 2 ? ["square", "triangle"] : ["zigzag", "triangle", "circle"];
    return pool[Math.floor(rand() * pool.length)];
  }, [level, seed]);

  const path = useMemo(() => shapePath(kind), [kind]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawn = useRef<Pt[]>([]);
  const drawing = useRef(false);
  const [retries, setRetries] = useState(0);
  const [hasInk, setHasInk] = useState(false);

  const redraw = useCallback(() => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 26;
    ctx.strokeStyle = "rgba(125,125,160,0.25)";
    ctx.lineCap = "round";
    ctx.beginPath();
    path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#7c5cff";
    ctx.beginPath();
    drawn.current.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }, [path]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const toLocal = (e: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    drawn.current.push(toLocal(e));
    setHasInk(true);
    redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawn.current.push(toLocal(e));
    redraw();
  };
  const up = () => {
    drawing.current = false;
  };

  const clear = () => {
    drawn.current = [];
    setHasInk(false);
    setRetries((r) => r + 1);
    redraw();
  };

  const finish = () => {
    if (disabled) return;
    const tol = 26;
    const pts = drawn.current;
    let off = 0;
    for (const p of pts) {
      let near = Infinity;
      for (const q of path) {
        const d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
        if (d < near) near = d;
      }
      if (Math.sqrt(near) > tol) off++;
    }
    let hit = 0;
    for (const q of path) {
      for (const p of pts) {
        if (Math.hypot(p.x - q.x, p.y - q.y) <= tol) {
          hit++;
          break;
        }
      }
    }
    const coverage = path.length ? hit / path.length : 0;
    const offRatio = pts.length ? off / pts.length : 1;
    onAnswer(coverage >= 0.6 && offRatio <= 0.35, {
      coverage: clampNum(coverage),
      offPath: off,
      retries,
    });
  };

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <Prompt>Trace the {kind === "line" ? "line" : kind} with your finger!</Prompt>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full max-w-[320px] touch-none rounded-3xl bg-secondary/40"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      <div className="flex gap-3">
        <Button variant="outline" size="lg" onClick={clear} disabled={disabled}>
          <Eraser className="h-4 w-4" /> Clear
        </Button>
        <Button variant="hero" size="lg" onClick={finish} disabled={disabled || !hasInk}>
          Done
        </Button>
      </div>
    </div>
  );
}
