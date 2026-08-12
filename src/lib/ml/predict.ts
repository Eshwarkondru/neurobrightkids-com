import {
  FEATURE_MEAN,
  FEATURE_STD,
  MODEL_VERSION,
  RISK_MODELS,
  TRAINING_INFO,
  type RiskTarget,
} from "./riskModel";

// Feature order must match MODEL_FEATURES:
// [age, attention, memory, reading, writing, math, engagement_min]
export type SkillVector = {
  age: number;
  attention: number;
  memory: number;
  reading: number;
  writing: number;
  math: number;
  engagement_min: number;
};

export type DomainAccuracy = {
  dyslexia: number; // 0..1
  adhd: number;
  dyscalculia: number;
  memory: number;
};

/** Accuracy (0..1) on a screening domain mapped onto the dataset's 0-100 skill scale. */
export function accuracyToSkill(accuracy: number): number {
  const a = Math.max(0, Math.min(1, accuracy));
  return Math.round((30 + 65 * a) * 10) / 10;
}

export function skillVectorFromAccuracy(
  acc: DomainAccuracy,
  opts?: { age?: number; engagementMinutes?: number },
): SkillVector {
  const reading = accuracyToSkill(acc.dyslexia);
  const attention = accuracyToSkill(acc.adhd);
  const math = accuracyToSkill(acc.dyscalculia);
  const memory = accuracyToSkill(acc.memory);
  // No writing task in the quiz: use the reading/memory composite as a proxy.
  const writing = Math.round(((reading + memory) / 2) * 10) / 10;
  return {
    age: opts?.age ?? Math.round(FEATURE_MEAN[0] ?? 11),
    attention,
    memory,
    reading,
    writing,
    math,
    engagement_min: opts?.engagementMinutes ?? FEATURE_MEAN[6] ?? 18,
  };
}

function toArray(v: SkillVector): number[] {
  return [v.age, v.attention, v.memory, v.reading, v.writing, v.math, v.engagement_min];
}

/** Ridge-regression inference: standardize, dot with weights, clamp to a 5-95% risk band. */
export function predictRisk(target: RiskTarget, v: SkillVector): number {
  const model = RISK_MODELS[target];
  const x = toArray(v);
  let y = model.intercept;
  for (let i = 0; i < x.length; i++) {
    const mean = FEATURE_MEAN[i] ?? 0;
    const std = FEATURE_STD[i] || 1;
    y += (model.weights[i] ?? 0) * ((x[i] ?? 0) - mean) / std;
  }
  return Math.round(Math.max(5, Math.min(95, y)));
}

export type RiskPrediction = {
  modelVersion: string;
  features: SkillVector;
  risks: Record<RiskTarget, number>;
  metrics: Record<RiskTarget, { r2: number; mae: number; auc: number | null }>;
  training: typeof TRAINING_INFO;
};

export function predictAllRisks(v: SkillVector): RiskPrediction {
  const targets = Object.keys(RISK_MODELS) as RiskTarget[];
  const risks = {} as Record<RiskTarget, number>;
  const metrics = {} as RiskPrediction["metrics"];
  for (const t of targets) {
    risks[t] = predictRisk(t, v);
    const m = RISK_MODELS[t];
    metrics[t] = { r2: m.r2, mae: m.mae, auc: m.auc };
  }
  return { modelVersion: MODEL_VERSION, features: v, risks, metrics, training: TRAINING_INFO };
}
