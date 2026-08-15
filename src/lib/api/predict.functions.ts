import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { predictEmbedded, type MlpPrediction, type Telemetry } from "@/lib/ml/mlp";

const unit = z.number().min(0).max(1);

export const telemetrySchema = z.object({
  age: z.number().min(3).max(20).default(11),
  accuracy_overall: unit,
  reading_accuracy: unit,
  attention_accuracy: unit,
  math_accuracy: unit,
  memory_score: unit,
  response_time_avg: z.number().min(0).max(600).default(6),
  response_time_var: z.number().min(0).max(10000).default(2),
  spelling_errors: z.number().min(0).max(50).default(0),
  mirror_letter_errors: z.number().min(0).max(50).default(0),
  retry_frequency: z.number().min(0).max(10).default(0),
  task_completion: unit.default(1),
  engagement_min: z.number().min(0).max(600).default(18),
});

/**
 * Screening inference: the child's assessment + behavioral telemetry goes
 * through the trained MLP (13 -> 64 -> 32 -> 4). When the ML_API_URL secret
 * points at the FastAPI service (ml/service/app.py) the prediction comes from
 * the joblib pipeline there; otherwise the same exported weights are run
 * in-process, which produces the same numbers. No heuristic scoring.
 */
export const predictScreeningRisk = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => telemetrySchema.parse(input))
  .handler(async ({ data }): Promise<MlpPrediction> => {
    const base = process.env["ML_API_URL"]?.replace(/\/$/, "");
    if (base) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${base}/predict`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`ML service responded ${res.status}`);
        const json = (await res.json()) as MlpPrediction;
        if (!json?.risks || typeof json.risks.dyslexia !== "number") {
          throw new Error("ML service returned an unexpected payload");
        }
        return { ...json, engine: "fastapi" };
      } catch (err) {
        console.error("FastAPI model service unavailable, using embedded weights", err);
      }
    }
    return predictEmbedded(data as Telemetry);
  });
