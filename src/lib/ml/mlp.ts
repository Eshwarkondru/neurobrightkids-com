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

export type MlpPrediction = {
  modelVersion: string;
  engine: "fastapi" | "embedded";
  risks: Record<RiskTarget, number>;
  metrics: Record<string, { r2: number; mae: number; auc: number | null }>;
  features: Telemetry;
  training: Record<string, unknown>;
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

export function predictEmbedded(t: Telemetry): MlpPrediction {
  return {
    modelVersion: MLP_MODEL.modelVersion,
    engine: "embedded",
    risks: runMlp(t),
    metrics: MLP_MODEL.card.metrics as MlpPrediction["metrics"],
    features: t,
    training: MLP_MODEL.card as unknown as Record<string, unknown>,
  };
}

export const MODEL_CARD = MLP_MODEL.card;
