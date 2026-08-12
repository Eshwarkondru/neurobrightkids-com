import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { predictAllRisks, skillVectorFromAccuracy } from "@/lib/ml/predict";

const accuracy = z.number().min(0).max(1);

// Screening inference endpoint: takes anonymous per-domain quiz accuracy and
// returns the ridge-regression model's risk estimates. No database access and
// no personal data, so it is safe to call before the child signs in.
export const predictScreeningRisk = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      dyslexia: accuracy,
      adhd: accuracy,
      dyscalculia: accuracy,
      memory: accuracy,
      age: z.number().int().min(3).max(20).optional(),
      engagementMinutes: z.number().min(0).max(600).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const vector = skillVectorFromAccuracy(
      { dyslexia: data.dyslexia, adhd: data.adhd, dyscalculia: data.dyscalculia, memory: data.memory },
      { age: data.age, engagementMinutes: data.engagementMinutes },
    );
    return predictAllRisks(vector);
  });
