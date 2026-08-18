"""FastAPI inference service for the NeuroLearn AI screening MLP.

Serves the exact pipeline trained by ml/train_mlp.py (StandardScaler + MLP
regressor) from ml/artifacts/neurolearn_mlp.joblib. No heuristics, no mocks:
every response is a forward pass through the trained network.

Run locally:
    pip install -r ml/requirements.txt
    python3 ml/train_mlp.py                  # produces the artifacts
    uvicorn app:app --host 0.0.0.0 --port 8000 --app-dir ml/service

Point the web app at it by setting the ML_API_URL secret to the service's
base URL (e.g. https://neurolearn-ml.onrender.com). Without it the app runs
the same weights through its built-in forward pass.
"""

from __future__ import annotations

import json
import pathlib
import sys

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from features import FEATURES, MODEL_VERSION, TARGETS  # noqa: E402

ARTIFACTS = pathlib.Path(__file__).resolve().parents[1] / "artifacts"
PIPELINE = joblib.load(ARTIFACTS / "neurolearn_mlp.joblib")
CARD = json.loads((ARTIFACTS / "model_card.json").read_text())

app = FastAPI(title="NeuroLearn AI screening model", version=MODEL_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class Telemetry(BaseModel):
    age: float = Field(11, ge=3, le=20)
    accuracy_overall: float = Field(..., ge=0, le=1)
    reading_accuracy: float = Field(..., ge=0, le=1)
    attention_accuracy: float = Field(..., ge=0, le=1)
    math_accuracy: float = Field(..., ge=0, le=1)
    memory_score: float = Field(..., ge=0, le=1)
    response_time_avg: float = Field(6.0, ge=0, le=600)
    response_time_var: float = Field(2.0, ge=0, le=10000)
    spelling_errors: float = Field(0, ge=0, le=50)
    mirror_letter_errors: float = Field(0, ge=0, le=50)
    retry_frequency: float = Field(0, ge=0, le=10)
    task_completion: float = Field(1.0, ge=0, le=1)
    engagement_min: float = Field(18.0, ge=0, le=600)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "modelVersion": MODEL_VERSION}


@app.get("/model-card")
def model_card() -> dict:
    return CARD


@app.post("/predict")
def predict(t: Telemetry) -> dict:
    try:
        x = np.asarray([[getattr(t, f) for f in FEATURES]], dtype=float)
        raw = PIPELINE.predict(x)[0]
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"inference failed: {exc}") from exc

    risks = {
        name.replace("risk_", ""): int(round(float(np.clip(v, 5, 95))))
        for name, v in zip(TARGETS, raw)
    }
    return {
        "modelVersion": MODEL_VERSION,
        "thresholdVersion": f"hr{CARD.get('highRiskThreshold')}",
        "engine": "fastapi",
        "risks": risks,
        "metrics": CARD["metrics"],
        "features": {f: getattr(t, f) for f in FEATURES},
        "training": {k: CARD[k] for k in ("algorithm", "totalSamples", "trainSamples", "testSamples", "split", "epochs")},
    }
