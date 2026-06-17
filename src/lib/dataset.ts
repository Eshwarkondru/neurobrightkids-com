import students from "@/data/students.json";
import summary from "@/data/dataset_summary.json";

export type StudentRow = {
  id: number; age: number; gender: string; grade: string; source: string;
  attention: number; memory: number; reading: number; writing: number; math: number;
  engagement_min: number; weekday: string; week: number;
  risk_dyslexia: number; risk_dysgraphia: number; risk_dyscalculia: number; risk_adhd: number;
};

export const dataset = students as StudentRow[];
export const datasetSummary = summary as {
  total_samples: number;
  sources: { name: string; count: number }[];
  age_range: [number, number];
  features: string[];
};

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const riskLevel = (v: number) => (v >= 65 ? "High" : v >= 40 ? "Moderate" : "Low");

export function computeAggregates() {
  const skills = [
    { name: "Attention", score: Math.round(avg(dataset.map(r => r.attention))) },
    { name: "Memory",    score: Math.round(avg(dataset.map(r => r.memory))) },
    { name: "Reading",   score: Math.round(avg(dataset.map(r => r.reading))) },
    { name: "Writing",   score: Math.round(avg(dataset.map(r => r.writing))) },
    { name: "Math",      score: Math.round(avg(dataset.map(r => r.math))) },
  ];

  const weeksMap = new Map<number, number[]>();
  for (const r of dataset) {
    const arr = weeksMap.get(r.week) ?? [];
    arr.push((r.attention + r.memory + r.reading + r.writing + r.math) / 5);
    weeksMap.set(r.week, arr);
  }
  const trend = Array.from(weeksMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([w, vals]) => ({ w: `W${w}`, score: Math.round(avg(vals)) }));

  const order = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const dayMap = new Map<string, number[]>();
  for (const r of dataset) {
    const arr = dayMap.get(r.weekday) ?? [];
    arr.push(r.engagement_min);
    dayMap.set(r.weekday, arr);
  }
  const sessions = order.map(d => ({ d, min: Math.round(avg(dayMap.get(d) ?? [0])) }));

  const riskRaw = [
    { name: "Dyslexia",    value: Math.round(avg(dataset.map(r => r.risk_dyslexia))) },
    { name: "Dysgraphia",  value: Math.round(avg(dataset.map(r => r.risk_dysgraphia))) },
    { name: "Dyscalculia", value: Math.round(avg(dataset.map(r => r.risk_dyscalculia))) },
    { name: "ADHD",        value: Math.round(avg(dataset.map(r => r.risk_adhd))) },
  ];
  const risk = riskRaw.map(r => ({ ...r, level: riskLevel(r.value) }));

  return { skills, trend, sessions, risk };
}
