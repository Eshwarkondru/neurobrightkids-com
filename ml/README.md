# NeuroLearn AI — deep-learning screening model

Real neural network (no mocks, no heuristics) predicting risk scores for
Dyslexia, Dysgraphia, Dyscalculia and ADHD from assessment + behavioral
telemetry.

## Contents

| Path | Purpose |
| --- | --- |
| `features.py` | Single source of truth for feature order (train == serve) |
| `train_mlp.py` | Trains the MLP, writes artifacts + exports weights to the web app |
| `service/app.py` | FastAPI inference service (`/predict`, `/health`, `/model-card`) |
| `artifacts/neurolearn_mlp.joblib` | Trained sklearn Pipeline (StandardScaler + MLPRegressor) |
| `artifacts/model_card.json` | Metrics, feature order, training config |

## Train

```bash
pip install -r ml/requirements.txt
python3 ml/train_mlp.py
```

Architecture: 13 inputs -> 64 -> 32 -> 4 (ReLU hidden, linear output), Adam,
early stopping, seed 42, 80/20 split of the 5,200-sample hybrid dataset in
`src/data/students.json`. Held-out test metrics land in the model card
(R² ≈ 0.52–0.55, MAE ≈ 6.5 risk points, ROC-AUC ≈ 0.84–0.90 for the
high-risk class).

### High-risk threshold and class balance

The dataset is skewed toward low-risk children. At a ≥60 cut-off only
0.1–2.3% of samples are positive, and the regressor — correctly hedging toward
the mean — almost never crossed it, giving ~0% high-risk recall for three of
the four disorders even with strong ranking (AUC) performance. The high-risk
decision threshold is therefore `HIGH_RISK_THRESHOLD = 40` (`ml/features.py`),
where positives are 8–39% of the data, and rare high-risk training rows are
oversampled so the network is not dominated by the low-risk majority.

The model card now records per-disorder confusion matrices with recall,
precision and F1 at that threshold (recall ≈ 0.28–0.65, precision ≈ 0.58–0.73).
Residual imbalance for dyslexia and dyscalculia remains a known limitation:
the model is stronger at ranking risk than at hard binary calls, which is why
the app presents graded risk percentages and screening-only disclaimers.


Training also regenerates `src/lib/ml/mlpModel.ts` — the same scaler
statistics and weight matrices — so the web app's forward pass reproduces the
service's output exactly.

## Serve

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --app-dir ml/service
curl -s localhost:8000/predict -H 'content-type: application/json' -d '{
  "age": 9, "accuracy_overall": 0.4, "reading_accuracy": 0.33,
  "attention_accuracy": 0.33, "math_accuracy": 0.66, "memory_score": 0.33,
  "response_time_avg": 9.2, "response_time_var": 7.1, "spelling_errors": 1,
  "mirror_letter_errors": 1, "retry_frequency": 0.4, "task_completion": 1,
  "engagement_min": 12
}'
```

## Connect it to the app

The web app calls the service when the `ML_API_URL` secret is set (e.g.
`https://your-service.onrender.com`); it verifies the model version and falls
back to the identical embedded weights if the service is unreachable, so the
deployed app never breaks. Deploy the service anywhere that runs Python
(Render, Railway, Fly, Hugging Face Spaces) with:

```
pip install -r ml/requirements.txt && python3 ml/train_mlp.py
uvicorn app:app --host 0.0.0.0 --port $PORT --app-dir ml/service
```

## Behavioral channels — full disclosure

The public datasets pooled into `students.json` publish skill scores and risk
labels, not raw interaction telemetry. The behavioral inputs (response time,
error counts, retries, completion) are therefore derived from those skill
scores with a fixed seed **at training time**, while at inference time they
come from the child's real interaction telemetry captured during the
assessment. The network, the training run and every served prediction are
real. There is no Transformer in this pipeline, and the app no longer claims
one.
