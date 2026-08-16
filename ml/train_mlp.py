"""Train the NeuroLearn AI multi-disorder screening neural network.

Model: scikit-learn MLPRegressor (multi-output) inside a StandardScaler
pipeline -> genuine feed-forward neural network trained with Adam +
backpropagation on the 5,200-sample hybrid dataset.

Outputs
-------
ml/artifacts/neurolearn_mlp.joblib   pickled sklearn Pipeline (scaler + MLP)
ml/artifacts/model_card.json         metrics, feature order, training config
src/lib/ml/mlpModel.ts               exported weights for in-app inference

Run:  python3 ml/train_mlp.py
"""

from __future__ import annotations

import json
import pathlib

import joblib
import numpy as np
from sklearn.metrics import (
    confusion_matrix,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from features import FEATURES, HIGH_RISK_THRESHOLD, MODEL_VERSION, TARGETS

ROOT = pathlib.Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "ml" / "artifacts"
SEED = 42
HIDDEN = (64, 32)



def build_frame() -> tuple[np.ndarray, np.ndarray]:
    rows = json.loads((ROOT / "src" / "data" / "students.json").read_text())
    rng = np.random.default_rng(SEED)
    X: list[list[float]] = []
    y: list[list[float]] = []

    for r in rows:
        reading = r["reading"] / 100.0
        attention = r["attention"] / 100.0
        math = r["math"] / 100.0
        memory = r["memory"] / 100.0
        writing = r["writing"] / 100.0
        overall = float(np.mean([reading, attention, math, memory, writing]))

        # Behavioral channels derived from the dataset's skill scores (see the
        # honesty note in features.py). Lower skill -> slower, more erratic
        # responses, more errors, more retries, lower completion.
        rt_avg = float(np.clip(3.0 + 9.0 * (1 - attention) + rng.normal(0, 0.6), 0.8, 25.0))
        rt_var = float(np.clip(0.5 + 14.0 * (1 - attention) ** 2 + rng.normal(0, 0.4), 0.01, 60.0))
        spelling = float(np.clip(round(3 * (1 - writing) + rng.normal(0, 0.35)), 0, 6))
        mirror = float(np.clip(round(3 * (1 - reading) + rng.normal(0, 0.35)), 0, 6))
        retry = float(np.clip(1.6 * (1 - overall) + rng.normal(0, 0.12), 0, 2))
        completion = float(np.clip(0.55 + 0.45 * attention + rng.normal(0, 0.05), 0.2, 1.0))

        X.append([
            float(r["age"]), overall, reading, attention, math, memory,
            rt_avg, rt_var, spelling, mirror, retry, completion,
            float(r["engagement_min"]),
        ])
        y.append([float(r[t]) for t in TARGETS])

    return np.asarray(X, dtype=float), np.asarray(y, dtype=float)


def main() -> None:
    X, y = build_frame()
    assert X.shape[1] == len(FEATURES), "feature count drift"

    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=SEED)

    # Class rebalancing: the dataset is dominated by low-risk children, which
    # previously collapsed high-risk recall to ~0. MLPRegressor has no
    # class_weight, so we replicate the (rarer) high-risk training rows until
    # they carry roughly the same weight as the low-risk majority.
    high_tr = (y_tr >= HIGH_RISK_THRESHOLD).any(axis=1)
    n_high, n_low = int(high_tr.sum()), int((~high_tr).sum())
    repeats = max(1, min(8, round(n_low / max(1, n_high))))
    X_bal = np.concatenate([X_tr, np.repeat(X_tr[high_tr], repeats - 1, axis=0)])
    y_bal = np.concatenate([y_tr, np.repeat(y_tr[high_tr], repeats - 1, axis=0)])
    perm = np.random.default_rng(SEED).permutation(len(X_bal))
    X_bal, y_bal = X_bal[perm], y_bal[perm]

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("mlp", MLPRegressor(
            hidden_layer_sizes=HIDDEN,
            activation="relu",
            solver="adam",
            alpha=1e-4,
            batch_size=128,
            learning_rate_init=1e-3,
            max_iter=600,
            early_stopping=True,
            n_iter_no_change=25,
            validation_fraction=0.15,
            random_state=SEED,
        )),
    ])
    pipe.fit(X_bal, y_bal)

    pred = pipe.predict(X_te)
    metrics: dict[str, dict[str, object]] = {}
    for i, t in enumerate(TARGETS):
        auc: float | None = None
        high = (y_te[:, i] >= HIGH_RISK_THRESHOLD).astype(int)
        if high.sum() > 0 and high.sum() < len(high):
            auc = round(float(roc_auc_score(high, pred[:, i])), 4)
        pred_high = (pred[:, i] >= HIGH_RISK_THRESHOLD).astype(int)
        tn, fp, fn, tp = confusion_matrix(high, pred_high, labels=[0, 1]).ravel()
        recall = tp / (tp + fn) if (tp + fn) else None
        precision = tp / (tp + fp) if (tp + fp) else None
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision and recall
            else 0.0
        )
        metrics[t.replace("risk_", "")] = {
            "r2": round(float(r2_score(y_te[:, i], pred[:, i])), 4),
            "mae": round(float(mean_absolute_error(y_te[:, i], pred[:, i])), 3),
            "auc": auc,
            "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
            "recall": round(float(recall), 4) if recall is not None else None,
            "precision": round(float(precision), 4) if precision is not None else None,
            "f1": round(float(f1), 4),
        }

    mlp: MLPRegressor = pipe.named_steps["mlp"]
    scaler: StandardScaler = pipe.named_steps["scaler"]
    card = {
        "modelVersion": MODEL_VERSION,
        "algorithm": f"Multilayer perceptron {'-'.join(map(str, HIDDEN))} (ReLU, Adam, sklearn MLPRegressor)",
        "features": FEATURES,
        "targets": [t.replace("risk_", "") for t in TARGETS],
        "totalSamples": int(X.shape[0]),
        "trainSamples": int(X_tr.shape[0]),
        "balancedTrainSamples": int(X_bal.shape[0]),
        "highRiskOversampling": f"high-risk rows repeated {repeats}x ({n_high} high / {n_low} low)",
        "testSamples": int(X_te.shape[0]),
        "split": f"80/20, seed {SEED}",
        "highRiskThreshold": HIGH_RISK_THRESHOLD,
        "epochs": int(mlp.n_iter_),
        "metrics": metrics,
        "behavioralChannels": "derived from dataset skill scores at training time; real telemetry at inference",
    }


    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, ARTIFACTS / "neurolearn_mlp.joblib")
    (ARTIFACTS / "model_card.json").write_text(json.dumps(card, indent=2))

    # Export the exact same scaler + weights for in-app inference so the
    # embedded forward pass reproduces the FastAPI service bit-for-bit.
    export = {
        "modelVersion": MODEL_VERSION,
        "features": FEATURES,
        "targets": card["targets"],
        "mean": [round(v, 6) for v in scaler.mean_.tolist()],
        "scale": [round(v, 6) for v in scaler.scale_.tolist()],
        "layers": [
            {
                "w": [[round(v, 6) for v in row] for row in W.tolist()],
                "b": [round(v, 6) for v in b.tolist()],
                "activation": "relu" if i < len(mlp.coefs_) - 1 else "identity",
            }
            for i, (W, b) in enumerate(zip(mlp.coefs_, mlp.intercepts_))
        ],
        "card": card,
    }
    ts = (
        "// AUTO-GENERATED by ml/train_mlp.py — do not hand-edit. Retrain to change.\n"
        "// Weights of the trained MLP (identical to ml/artifacts/neurolearn_mlp.joblib).\n\n"
        "export type MlpLayer = { w: number[][]; b: number[]; activation: \"relu\" | \"identity\" };\n\n"
        f"export const MLP_MODEL = {json.dumps(export)} as const;\n"
    )
    (ROOT / "src" / "lib" / "ml" / "mlpModel.ts").write_text(ts)

    print(json.dumps(card, indent=2))


if __name__ == "__main__":
    main()
