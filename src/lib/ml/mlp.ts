import { MLP_MODEL } from "./mlpModel";

/**
 * Feature contract — must match ml/features.py exactly. The order here is the
 * order the trained network's input layer expects.
 */
export const MLP_FEATURES = MLP_MODEL.features as readonly string[];

export type Telemetry = {
  age: number;
  accuracy_overall: number;
  reading_accuracy: number;
  attention_accuracy: number;
  math_accuracy: number;
  memory_score: number;
  response_time_avg: number;
  response_time_var: number;
  spelling_errors: number;
  mirror_letter_errors: number;
  retry_frequency: number;
  task_completion: number;
  engagement_min: number;
};

export type RiskTarget = "dyslexia" | "dysgraphia" | "dyscalculia" | "adhd";

export type MlpTraining = {
  algorithm: string;
  totalSamples: number;
  trainSamples: number;
  testSamples: number;
  split: string;
  epochs: number;
};

export type MlpPrediction = {
  modelVersion: string;
  /** Version tag of the decision thresholds applied to the raw risk scores. */
  thresholdVersion: string;
  engine: "fastapi" | "embedded";
  risks: Record<RiskTarget, number>;
  metrics: Record<
    string,
    {
      r2: number;
      mae: number;
      auc: number | null;
      recall?: number | null;
      precision?: number | null;
      f1?: number;
      confusion?: { tn: number; fp: number; fn: number; tp: number };
    }
  >;

  features: Telemetry;
  training: MlpTraining;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Forward pass through the trained MLP using the exported scaler statistics
 * and weight matrices (identical numbers to the joblib pipeline the FastAPI
 * service loads), so predictions are reproducible in either engine.
 */
export function runMlp(t: Telemetry): Record<RiskTarget, number> {
  const raw = MLP_FEATURES.map((f) => Number((t as unknown as Record<string, number>)[f] ?? 0));
  let a = raw.map((v, i) => (v - (MLP_MODEL.mean[i] ?? 0)) / (MLP_MODEL.scale[i] || 1));

  for (const layer of MLP_MODEL.layers) {
    const out = new Array<number>(layer.b.length).fill(0);
    for (let j = 0; j < out.length; j++) {
      let s = layer.b[j] ?? 0;
      for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (layer.w[i]?.[j] ?? 0);
      out[j] = layer.activation === "relu" ? Math.max(0, s) : s;
    }
    a = out;
  }

  const targets = MLP_MODEL.targets as readonly RiskTarget[];
  const risks = {} as Record<RiskTarget, number>;
  targets.forEach((t2, i) => {
    risks[t2] = Math.round(clamp(a[i] ?? 0, 5, 95));
  });
  return risks;
}

/**
 * Threshold version tag: derived from the high-risk cut-off baked into the
 * trained model card, so a report always records which cut-off produced its
 * severity levels.
 */
export const THRESHOLD_VERSION = `hr${MLP_MODEL.card.highRiskThreshold}`;

export function predictEmbedded(t: Telemetry): MlpPrediction {
  return {
    modelVersion: MLP_MODEL.modelVersion,
    thresholdVersion: THRESHOLD_VERSION,
    engine: "embedded",
    risks: runMlp(t),
    metrics: MLP_MODEL.card.metrics as MlpPrediction["metrics"],
    features: t,
    training: {
      algorithm: MLP_MODEL.card.algorithm,
      totalSamples: MLP_MODEL.card.totalSamples,
      trainSamples: MLP_MODEL.card.trainSamples,
      testSamples: MLP_MODEL.card.testSamples,
      split: MLP_MODEL.card.split,
      epochs: MLP_MODEL.card.epochs,
    },
  };
}

export const MODEL_CARD = MLP_MODEL.card;
