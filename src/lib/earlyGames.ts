import type { Disorder } from "@/lib/assessment";

/** Early Skills Games (ages 6-7). Stored in game_sessions as `early_<key>`. */
export type EarlyGameKey =
  | "letter_match"
  | "picture_match"
  | "same_diff"
  | "count_objects"
  | "number_order"
  | "memory_cards"
  | "pattern"
  | "odd_one"
  | "listen_choose"
  | "word_builder"
  | "follow_instructions"
  | "trace_shape";

export type Level = 1 | 2 | 3;

export const LEVEL_LABEL: Record<Level, string> = {
  1: "Beginner",
  2: "Basic",
  3: "Challenge",
};

/** Which screening domain each activity contributes evidence to. */
export const EARLY_GAME_TO_DISORDER: Record<EarlyGameKey, Disorder> = {
  letter_match: "dyslexia",
  picture_match: "dyslexia",
  word_builder: "dyslexia",
  listen_choose: "dyslexia",
  count_objects: "dyscalculia",
  number_order: "dyscalculia",
  memory_cards: "memory",
  same_diff: "memory",
  pattern: "memory",
  odd_one: "adhd",
  follow_instructions: "adhd",
  trace_shape: "dysgraphia",
};

/** Extra behavioural metric key each activity feeds into the analytics pipeline. */
export const EARLY_GAME_METRIC: Record<EarlyGameKey, string> = {
  letter_match: "reading_accuracy",
  picture_match: "reading_accuracy",
  word_builder: "reading_accuracy",
  listen_choose: "phonics_accuracy",
  count_objects: "math_accuracy",
  number_order: "math_accuracy",
  memory_cards: "memory_score",
  same_diff: "visual_discrimination_score",
  pattern: "visual_discrimination_score",
  odd_one: "attention_score",
  follow_instructions: "attention_score",
  trace_shape: "writing_trace_score",
};

export type EarlyGameMeta = {
  key: EarlyGameKey;
  name: string;
  emoji: string;
  blurb: string;
  skill: string;
  rounds: number;
  color: string;
};

export const EARLY_GAMES: EarlyGameMeta[] = [
  { key: "letter_match", name: "Letter Match", emoji: "🔤", blurb: "Find the same letter!", skill: "Reading", rounds: 5, color: "from-violet-500 to-fuchsia-500" },
  { key: "picture_match", name: "Picture Match", emoji: "🖼️", blurb: "Which word is the picture?", skill: "Words", rounds: 5, color: "from-blue-500 to-cyan-500" },
  { key: "same_diff", name: "Same or Different", emoji: "👀", blurb: "Are they the same?", skill: "Looking", rounds: 5, color: "from-emerald-500 to-teal-500" },
  { key: "count_objects", name: "Count the Objects", emoji: "🍎", blurb: "How many do you see?", skill: "Numbers", rounds: 5, color: "from-rose-500 to-orange-500" },
  { key: "number_order", name: "Number Order", emoji: "🔢", blurb: "Which number is missing?", skill: "Numbers", rounds: 5, color: "from-amber-500 to-yellow-500" },
  { key: "memory_cards", name: "Memory Cards", emoji: "🃏", blurb: "Remember and match!", skill: "Memory", rounds: 3, color: "from-purple-500 to-indigo-500" },
  { key: "pattern", name: "Follow the Pattern", emoji: "🔴", blurb: "What comes next?", skill: "Thinking", rounds: 5, color: "from-pink-500 to-rose-500" },
  { key: "odd_one", name: "Find the Odd One", emoji: "⭐", blurb: "Tap the different one!", skill: "Attention", rounds: 5, color: "from-cyan-500 to-blue-500" },
  { key: "listen_choose", name: "Listen and Choose", emoji: "🔊", blurb: "Hear the word, pick it!", skill: "Sounds", rounds: 5, color: "from-fuchsia-500 to-purple-500" },
  { key: "word_builder", name: "Word Builder", emoji: "🧩", blurb: "Tap letters to build the word!", skill: "Spelling", rounds: 4, color: "from-teal-500 to-emerald-500" },
  { key: "follow_instructions", name: "Follow the Instructions", emoji: "🙌", blurb: "Do what it says!", skill: "Attention", rounds: 5, color: "from-orange-500 to-red-500" },
  { key: "trace_shape", name: "Trace the Shape", emoji: "✏️", blurb: "Trace with your finger!", skill: "Writing", rounds: 3, color: "from-sky-500 to-indigo-500" },
];

const LEVEL_STORE = "neurolearn_early_level";

export function loadLevel(key: EarlyGameKey): Level {
  if (typeof window === "undefined") return 1;
  try {
    const raw = window.localStorage.getItem(`${LEVEL_STORE}_${key}`);
    const n = Number(raw);
    return n === 2 || n === 3 ? (n as Level) : 1;
  } catch {
    return 1;
  }
}

export function saveLevel(key: EarlyGameKey, level: Level) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LEVEL_STORE}_${key}`, String(level));
  } catch {
    /* storage unavailable — level simply resets next visit */
  }
}

/** Accuracy-driven progression: >=80% moves up, <50% repeats with easier practice. */
export function nextLevel(current: Level, accuracy: number): Level {
  if (accuracy >= 0.8 && current < 3) return (current + 1) as Level;
  return current;
}

export function encouragement(accuracy: number): string {
  if (accuracy >= 0.9) return "Awesome! 🌟";
  if (accuracy >= 0.7) return "Great job! 🎉";
  if (accuracy >= 0.4) return "Nice try! 👍";
  return "Let's try again together! 💛";
}
