import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type Disorder = "dyslexia" | "dysgraphia" | "adhd" | "dyscalculia" | "memory";

/** Behavioural channel an item contributes evidence to. */
export type TaskType = "reading" | "phonics" | "writing" | "math" | "memory" | "attention";

export type AssessmentQuestion = {
  id: string;
  disorder: Disorder;
  taskType: TaskType;
  title: string;
  q: string;
  options: string[];
  answer: number;
  /** A wrong answer here is evidence of a spelling error. */
  spellingItem?: boolean;
  /** A wrong answer here is evidence of mirror/letter-reversal confusion. */
  mirrorItem?: boolean;
};

// 15 items across 5 domains (3 each). Higher item accuracy = LOWER risk evidence
// for that domain. Answer keys are verified in test/assessment.test.ts.
export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // Dyslexia — phonics / mirror letters / word recognition
  { id: "d1", disorder: "dyslexia", taskType: "phonics", title: "Reading & Phonics", q: "Which word matches the sound 'cat'?", options: ["bat", "cat", "rat", "hat"], answer: 1 },
  { id: "d2", disorder: "dyslexia", taskType: "reading", title: "Mirror Letters", q: "Which letter is the mirror of 'b'?", options: ["p", "d", "q", "g"], answer: 1, mirrorItem: true },
  { id: "d3", disorder: "dyslexia", taskType: "reading", title: "Word Recognition", q: "Pick the correctly spelled word:", options: ["freind", "friend", "frined", "frein"], answer: 1, spellingItem: true },
  // Dysgraphia — letter formation / copying / spacing
  { id: "g1", disorder: "dysgraphia", taskType: "writing", title: "Letter Formation", q: "Which letter below is written backwards?", options: ["a", "m", "ᴎ", "e"], answer: 2, mirrorItem: true },
  { id: "g2", disorder: "dysgraphia", taskType: "writing", title: "Copying Accuracy", q: "Copy this word exactly — blue. Which one matches?", options: ["bleu", "blue", "bule", "blu"], answer: 1, spellingItem: true },
  { id: "g3", disorder: "dysgraphia", taskType: "writing", title: "Spacing & Order", q: "Which sentence has correct word spacing?", options: ["I like dogs", "Ilike dogs", "I likedogs", "Ilikedogs"], answer: 0 },
  // ADHD — attention / distractor
  { id: "a1", disorder: "adhd", taskType: "attention", title: "Focus Span", q: "Find the odd one: 🔵 🔵 🔴 🔵", options: ["1st", "2nd", "3rd", "4th"], answer: 2 },
  { id: "a2", disorder: "adhd", taskType: "attention", title: "Attention", q: "Which shape appears twice? ▲ ■ ● ▲ ◆", options: ["Square", "Circle", "Triangle", "Diamond"], answer: 2 },
  { id: "a3", disorder: "adhd", taskType: "attention", title: "Sustained Focus", q: "In 7 3 9 3 5 3 8, how many 3s appear?", options: ["1", "2", "3", "4"], answer: 2 },
  // Dyscalculia — number sense
  { id: "m1", disorder: "dyscalculia", taskType: "math", title: "Number Sense", q: "Which group has more? ●●●● vs ●●●", options: ["Left", "Right", "Same", "Not sure"], answer: 0 },
  { id: "m2", disorder: "dyscalculia", taskType: "math", title: "Arithmetic", q: "What is 6 + 5?", options: ["10", "11", "12", "13"], answer: 1 },
  { id: "m3", disorder: "dyscalculia", taskType: "math", title: "Comparison", q: "Which is largest?", options: ["17", "71", "27", "37"], answer: 1 },
  // Working memory
  { id: "w1", disorder: "memory", taskType: "memory", title: "Sequence Recall", q: "Remember 3, 7, 2. Which sequence is it?", options: ["3,2,7", "7,3,2", "3,7,2", "2,7,3"], answer: 2 },
  { id: "w2", disorder: "memory", taskType: "memory", title: "Working Memory", q: "Reverse of 4, 8, 1 is:", options: ["1,8,4", "4,1,8", "8,4,1", "1,4,8"], answer: 0 },
  { id: "w3", disorder: "memory", taskType: "memory", title: "Recall", q: "The first question was about matching the sound of which word?", options: ["dog", "cat", "sun", "car"], answer: 1 },
];

export const DISORDER_LABEL: Record<Disorder, string> = {
  dyslexia: "Dyslexia",
  dysgraphia: "Dysgraphia",
  adhd: "ADHD",
  dyscalculia: "Dyscalculia",
  memory: "Working Memory",
};


export type Severity = "Very Low" | "Mild" | "Moderate" | "High" | "Very High";

export function severityFor(percent: number): Severity {
  if (percent <= 20) return "Very Low";
  if (percent <= 40) return "Mild";
  if (percent <= 60) return "Moderate";
  if (percent <= 80) return "High";
  return "Very High";
}

export function severityColor(sev: Severity): string {
  switch (sev) {
    case "Very Low": return "#10b981";
    case "Mild": return "#22c55e";
    case "Moderate": return "#f59e0b";
    case "High": return "#f97316";
    case "Very High": return "#ef4444";
  }
}

export type DisorderResult = {
  disorder: Disorder;
  label: string;
  percent: number; // risk percentage (0-100)
  severity: Severity;
  correct: number;
  total: number;
  source?: "model" | "heuristic";
};

export type AssessmentResult = {
  results: DisorderResult[];
  highest: DisorderResult;
  totalCorrect: number;
  totalQuestions: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  therapist: string[];
  recommendedGames: { key: string; name: string; reason: string }[];
};

export function computeAssessment(answers: number[]): AssessmentResult {
  const perDisorder: Record<Disorder, { correct: number; total: number }> = {
    dyslexia: { correct: 0, total: 0 },
    dysgraphia: { correct: 0, total: 0 },
    adhd: { correct: 0, total: 0 },
    dyscalculia: { correct: 0, total: 0 },
    memory: { correct: 0, total: 0 },
  };

  ASSESSMENT_QUESTIONS.forEach((q, idx) => {
    perDisorder[q.disorder].total += 1;
    if (answers[idx] === q.answer) perDisorder[q.disorder].correct += 1;
  });

  const results: DisorderResult[] = (Object.keys(perDisorder) as Disorder[]).map((d) => {
    const { correct, total } = perDisorder[d];
    // risk = (1 - accuracy). Weight so full-correct = ~10% risk, zero-correct = ~95%.
    const accuracy = total > 0 ? correct / total : 0;
    const percent = Math.round(Math.max(5, Math.min(95, (1 - accuracy) * 90 + 5)));
    return { disorder: d, label: DISORDER_LABEL[d], percent, severity: severityFor(percent), correct, total };
  }).sort((a, b) => b.percent - a.percent);

  const highest = results[0];
  const totalCorrect = answers.reduce((acc, ans, idx) => acc + (ans === ASSESSMENT_QUESTIONS[idx]?.answer ? 1 : 0), 0);

  const strengths = results.filter((r) => r.percent <= 40).map((r) => `${r.label} skills are age-appropriate`);
  const weaknesses = results.filter((r) => r.percent >= 60).map((r) => `${r.label} shows elevated risk (${r.percent}%)`);

  return {
    results,
    highest,
    totalCorrect,
    totalQuestions: ASSESSMENT_QUESTIONS.length,
    strengths: strengths.length ? strengths : ["Balanced performance across all measured skills"],
    weaknesses: weaknesses.length ? weaknesses : ["No area currently exceeds moderate risk"],
    recommendations: recommendationsFor(highest.disorder),
    therapist: therapistFor(highest.disorder),
    recommendedGames: recommendedGamesFor(highest.disorder),
  };
}

/**
 * Replace the heuristic risk percentages with the trained model's predictions
 * for the domains the ML model covers, then re-derive severity, ordering,
 * strengths/weaknesses and the recommendation set from the updated scores.
 */
export function applyModelRisks(
  res: AssessmentResult,
  risks: Partial<Record<Disorder, number>>,
): AssessmentResult {
  const results = res.results
    .map((r) => {
      const ml = risks[r.disorder];
      if (typeof ml !== "number" || Number.isNaN(ml)) return { ...r, source: "heuristic" as const };
      const percent = Math.round(Math.max(5, Math.min(95, ml)));
      return { ...r, percent, severity: severityFor(percent), source: "model" as const };
    })
    .sort((a, b) => b.percent - a.percent);

  const highest = results[0] ?? res.highest;
  const strengths = results.filter((r) => r.percent <= 40).map((r) => `${r.label} skills are age-appropriate`);
  const weaknesses = results.filter((r) => r.percent >= 60).map((r) => `${r.label} shows elevated risk (${r.percent}%)`);

  return {
    ...res,
    results,
    highest,
    strengths: strengths.length ? strengths : ["Balanced performance across all measured skills"],
    weaknesses: weaknesses.length ? weaknesses : ["No area currently exceeds moderate risk"],
    recommendations: recommendationsFor(highest.disorder),
    therapist: therapistFor(highest.disorder),
    recommendedGames: recommendedGamesFor(highest.disorder),
  };
}

function recommendationsFor(d: Disorder): string[] {
  switch (d) {
    case "dyslexia": return [
      "Daily 15-minute phonics practice with letter-sound flashcards",
      "Use color overlays or larger, dyslexia-friendly fonts when reading",
      "Read aloud with the child and pause to sound out unfamiliar words",
    ];
    case "dysgraphia": return [
      "Daily 10-minute letter-formation practice on lined or grid paper",
      "Use a pencil grip and short tracing sheets before free writing",
      "Let the child dictate ideas first, then copy them down in short lines",
    ];
    case "adhd": return [

      "Break tasks into 10-minute chunks with movement breaks in between",
      "Use visual timers and checklists for daily routines",
      "Create a low-distraction, well-lit study area",
    ];
    case "dyscalculia": return [
      "Use physical objects (counters, blocks) to build number sense",
      "Practice number comparison and estimation games daily",
      "Introduce math concepts visually before symbols",
    ];
    case "memory": return [
      "Play sequence-recall games daily, gradually increasing length",
      "Chunk information into groups of 3 when memorizing",
      "Use mnemonics, rhymes, and visualization strategies",
    ];
  }
}

function therapistFor(d: Disorder): string[] {
  switch (d) {
    case "dyslexia": return ["Consult a certified reading specialist", "Consider an Orton-Gillingham based tutor", "Speech-language pathologist for phonological support"];
    case "dysgraphia": return ["Consult an occupational therapist for handwriting support", "Ask the school about assistive writing tools and extra time", "Educational psychologist for a written-expression evaluation"];
    case "adhd": return ["Consult a pediatric behavioral therapist", "Occupational therapist for sensory & focus strategies", "Discuss ADHD screening with a pediatrician"];

    case "dyscalculia": return ["Consult an educational psychologist for math evaluation", "Specialized math tutor familiar with dyscalculia", "Occupational therapist for visual-spatial support"];
    case "memory": return ["Consult an educational psychologist for cognitive assessment", "Cognitive skills trainer for working memory", "Occupational therapist for executive function support"];
  }
}

export function recommendedGamesFor(d: Disorder): { key: string; name: string; reason: string }[] {
  switch (d) {
    case "dyslexia": return [
      { key: "mirror", name: "Mirror Letter Challenge", reason: "Trains letter-reversal recognition" },
      { key: "phonics", name: "Phonics Adventure", reason: "Builds sound-letter mapping" },
      { key: "shape", name: "Shape Recognition", reason: "Supports visual discrimination" },
    ];
    case "dysgraphia": return [
      { key: "writing", name: "Letter Tracing Studio", reason: "Direct letter-formation and stroke practice" },
      { key: "mirror", name: "Mirror Letter Challenge", reason: "Reduces letter-reversal in writing" },
      { key: "shape", name: "Shape Recognition", reason: "Builds visual-motor control" },
    ];
    case "adhd": return [

      { key: "focus", name: "Focus Challenge", reason: "Improves sustained attention" },
      { key: "memory", name: "Memory Quest", reason: "Strengthens working memory" },
      { key: "shape", name: "Shape Recognition", reason: "Attention-to-detail practice" },
    ];
    case "dyscalculia": return [
      { key: "math", name: "Math Puzzle Arena", reason: "Direct number-sense training" },
      { key: "shape", name: "Shape Recognition", reason: "Spatial & quantity reasoning" },
      { key: "memory", name: "Memory Quest", reason: "Supports math working memory" },
    ];
    case "memory": return [
      { key: "memory", name: "Memory Quest", reason: "Direct working-memory practice" },
      { key: "focus", name: "Focus Challenge", reason: "Attention supports memory" },
      { key: "phonics", name: "Phonics Adventure", reason: "Verbal memory training" },
    ];
  }
}

export type ChildInfo = { name: string; age: number | null; grade: string | null };

export type ReportRowLike = {
  scores: unknown;
  highest_disorder: string | null;
  highest_percent: number | null;
  risk_level: string | null;
  recommendations: unknown;
  therapist: unknown;
  recommended_games: unknown;
  strengths: unknown;
  weaknesses: unknown;
  total_correct: number;
  total_questions: number;
};

function asStr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
function asGames(v: unknown): { key: string; name: string; reason: string }[] {
  return Array.isArray(v)
    ? v.filter(
        (g): g is { key: string; name: string; reason: string } =>
          !!g &&
          typeof (g as { key?: unknown }).key === "string" &&
          typeof (g as { name?: unknown }).name === "string" &&
          typeof (g as { reason?: unknown }).reason === "string",
      )
    : [];
}

export function resultFromReportRow(r: ReportRowLike): AssessmentResult {
  const rawScores = Array.isArray(r.scores) ? (r.scores as unknown[]) : [];
  const results: DisorderResult[] = rawScores
    .map((raw) => {
      const item = raw as Partial<DisorderResult> & { disorder?: string; percent?: number };
      const disorder = (item.disorder as Disorder) ?? "memory";
      const percent = typeof item.percent === "number" ? item.percent : 0;
      return {
        disorder,
        label: item.label ?? DISORDER_LABEL[disorder] ?? String(disorder),
        percent,
        severity: (item.severity as Severity) ?? severityFor(percent),
        correct: typeof item.correct === "number" ? item.correct : 0,
        total: typeof item.total === "number" ? item.total : 0,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  const highest: DisorderResult =
    results[0] ?? {
      disorder: "memory",
      label: r.highest_disorder ?? "—",
      percent: r.highest_percent ?? 0,
      severity: (r.risk_level as Severity) ?? severityFor(r.highest_percent ?? 0),
      correct: 0,
      total: 0,
    };

  return {
    results,
    highest,
    totalCorrect: r.total_correct,
    totalQuestions: r.total_questions,
    strengths: asStr(r.strengths),
    weaknesses: asStr(r.weaknesses),
    recommendations: asStr(r.recommendations),
    therapist: asStr(r.therapist),
    recommendedGames: asGames(r.recommended_games),
  };
}


export type ReportPDFOptions = {
  reportId: string;
  child: ChildInfo;
  date: string;
  result: AssessmentResult;
};

function buildReportPDF(opts: ReportPDFOptions): { doc: jsPDF; fileName: string } {
  const { reportId, child, date, result } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 50;

  // Header
  doc.setFillColor(59, 130, 246);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("NeuroLearn AI — Personalized Report", 40, 45);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Report ID: ${reportId}`, 40, 65);

  y = 110;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Child Information", 40, y);
  y += 8;
  doc.setDrawColor(200); doc.line(40, y, pageW - 40, y); y += 16;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`Name: ${child.name}`, 40, y); doc.text(`Age: ${child.age ?? "-"}`, 300, y); y += 16;
  doc.text(`Grade: ${child.grade ?? "-"}`, 40, y); doc.text(`Assessment Date: ${date}`, 300, y); y += 24;

  // Results table
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Disorder Risk Analysis", 40, y); y += 6;
  autoTable(doc, {
    startY: y + 6,
    head: [["Disorder", "Percentage", "Severity", "Correct / Total"]],
    body: result.results.map((r) => [r.label, `${r.percent}%`, r.severity, `${r.correct} / ${r.total}`]),
    headStyles: { fillColor: [59, 130, 246], textColor: 255 },
    bodyStyles: { fontSize: 10 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const sev = data.cell.raw as Severity;
        const rgb = hexToRgb(severityColor(sev));
        data.cell.styles.textColor = rgb;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  // @ts-expect-error autotable adds lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 24;

  // Bar chart (drawn manually)
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text("Risk Chart", 40, y); y += 10;
  const chartX = 40, chartW = pageW - 80, chartH = 140;
  const barW = chartW / result.results.length - 12;
  doc.setDrawColor(220); doc.rect(chartX, y, chartW, chartH);
  result.results.forEach((r, i) => {
    const barH = (r.percent / 100) * (chartH - 24);
    const x = chartX + 8 + i * (barW + 12);
    const rgb = hexToRgb(severityColor(r.severity));
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y + chartH - barH - 12, barW, barH, "F");
    doc.setFontSize(9); doc.setTextColor(60);
    doc.text(`${r.percent}%`, x + barW / 2, y + chartH - barH - 16, { align: "center" });
    doc.text(r.label, x + barW / 2, y + chartH + 4, { align: "center", maxWidth: barW + 10 });
  });
  y += chartH + 30;

  // Sections
  y = section(doc, y, "Highest-Risk Disorder", [`${result.highest.label} — ${result.highest.percent}% (${result.highest.severity})`]);
  y = section(doc, y, "Strengths", result.strengths);
  y = section(doc, y, "Weaknesses", result.weaknesses);
  y = section(doc, y, "Recommendations", result.recommendations);
  y = section(doc, y, "Therapist Suggestions", result.therapist);
  y = section(doc, y, "Recommended Games", result.recommendedGames.map((g) => `${g.name} — ${g.reason}`));

  doc.setFontSize(9); doc.setTextColor(140);
  doc.text("Generated by NeuroLearn AI · Screening only — not a clinical diagnosis.", 40, doc.internal.pageSize.getHeight() - 24);

  return { doc, fileName: `NeuroLearn-Report-${reportId}.pdf` };
}

export function generateReportPDF(opts: ReportPDFOptions): void {
  const { doc, fileName } = buildReportPDF(opts);
  doc.save(fileName);
}

export function reportPDFBlob(opts: ReportPDFOptions): { blob: Blob; fileName: string } {
  const { doc, fileName } = buildReportPDF(opts);
  return { blob: doc.output("blob"), fileName };
}

export async function shareReportPDF(opts: ReportPDFOptions): Promise<"shared" | "downloaded"> {
  const { blob, fileName } = reportPDFBlob(opts);
  const title = `NeuroLearn Report — ${opts.child.name}`;
  const text = `${opts.child.name}'s NeuroLearn assessment report (${opts.reportId}) · Highest risk: ${opts.result.highest.label} ${opts.result.highest.percent}% (${opts.result.highest.severity}).`;
  try {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }) : null;
    const file = new File([blob], fileName, { type: "application/pdf" });
    if (nav?.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ title, text, files: [file] });
      return "shared";
    }
  } catch (err) {
    // fall through to download
    console.warn("share failed, falling back to download", err);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

function section(doc: jsPDF, y: number, title: string, items: string[]): number {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  if (y > pageH - 120) { doc.addPage(); y = 50; }
  doc.setTextColor(30); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(title, 40, y); y += 6;
  doc.setDrawColor(220); doc.line(40, y, pageW - 40, y); y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  items.forEach((it) => {
    const lines = doc.splitTextToSize(`• ${it}`, pageW - 80);
    if (y + lines.length * 14 > pageH - 60) { doc.addPage(); y = 50; }
    doc.text(lines, 44, y);
    y += lines.length * 14 + 2;
  });
  return y + 14;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
