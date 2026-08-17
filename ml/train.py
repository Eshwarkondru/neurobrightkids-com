"""Reproducible training pipeline for NeuroLearn AI.

    python3 ml/train.py [--synthetic 5200]

Steps: load dataset -> validate columns -> drop invalid/duplicate/missing ->
feature engineering (already applied by the dataset layer) -> leakage analysis
-> stratified train/val/test split -> train CatBoost, LightGBM, attention NN and
Transformer -> evaluate on all three splits -> select thresholds on validation
-> save models, preprocessing pipeline, metrics, confusion matrices, feature
importance, model report -> export the web fallback weights.

Everything is seeded with random_state = 42.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import torch
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "models"))

import leakage  # noqa: E402
import thresholds as thr  # noqa: E402
from dataset import build  # noqa: E402
from export_web import export_attention_to_ts  # noqa: E402
from features import (  # noqa: E402
    DATASET_VERSION, EVENT_CHANNELS, FEATURE_VERSION, FEATURES, MAX_SEQ_LEN,
    MODEL_VERSIONS, TARGETS, TASK_TYPES, encode_sequence, vectorize,
)
from models.attention import attention_importance, proba as attn_proba, train_attention  # noqa: E402
from models.tabular import MultiLabelBooster  # noqa: E402
from models.transformer import proba as tr_proba, train_transformer  # noqa: E402

SEED = 42
ROOT = pathlib.Path(__file__).resolve().parent
MODELS = ROOT / "models_store"
ARTIFACTS = ROOT / "artifacts"
METRICS = ROOT / "metrics"
REPORTS = ROOT / "reports"
for d in (MODELS, ARTIFACTS, METRICS, REPORTS):
    d.mkdir(parents=True, exist_ok=True)


def evaluate(y: np.ndarray, p: np.ndarray, thresholds: dict[str, float]) -> dict:
    out: dict = {}
    for k, t in enumerate(TARGETS):
        yt, pp = y[:, k], p[:, k]
        pred = (pp >= thresholds[t]).astype(int)
        auc = None
        if len(set(yt.tolist())) > 1:
            auc = round(float(roc_auc_score(yt, pp)), 4)
        cm = confusion_matrix(yt, pred, labels=[0, 1]).tolist()
        out[t] = {
            "threshold": thresholds[t],
            "accuracy": round(float(accuracy_score(yt, pred)), 4),
            "precision": round(float(precision_score(yt, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(yt, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(yt, pred, zero_division=0)), 4),
            "rocAuc": auc,
            "confusionMatrix": {"tn": cm[0][0], "fp": cm[0][1], "fn": cm[1][0], "tp": cm[1][1]},
            "support": {"positives": int(yt.sum()), "total": int(len(yt))},
            "classificationReport": classification_report(
                yt, pred, labels=[0, 1], target_names=["not_elevated", "elevated"],
                zero_division=0, output_dict=True,
            ),
        }
    macro = {
        m: round(float(np.mean([out[t][m] for t in TARGETS])), 4)
        for m in ("accuracy", "precision", "recall", "f1")
    }
    aucs = [out[t]["rocAuc"] for t in TARGETS if out[t]["rocAuc"] is not None]
    macro["rocAuc"] = round(float(np.mean(aucs)), 4) if aucs else None
    return {"perDisorder": out, "macro": macro}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", type=int, default=5200)
    args = ap.parse_args()
    t0 = time.time()

    # 1-6. Load + validate + clean + engineer.
    records, build_report = build(n_synthetic=args.synthetic, seed=SEED)
    if len(records) < 200:
        raise SystemExit("not enough usable records to train")
    X = np.asarray([vectorize(r["features"]) for r in records], dtype=np.float32)
    Y = np.asarray([[r["labels"][t] for t in TARGETS] for r in records], dtype=np.float32)

    # 6b. Leakage analysis before any model sees the data.
    candidate_columns = sorted({k for r in records for k in r["features"]} | {"labels", f"label_{TARGETS[0]}"})
    leak = leakage.analyse(X, Y, candidate_columns)
    (REPORTS / "leakage_report.json").write_text(json.dumps(leak, indent=2))

    # 7-8. Stratified split (stratify on the multi-label pattern; prevents leakage
    # by splitting on students, one row per student).
    strat = ["".join(str(int(v)) for v in row) for row in Y]
    counts: dict[str, int] = {}
    for s in strat:
        counts[s] = counts.get(s, 0) + 1
    strat_safe = [s if counts[s] >= 6 else "rare" for s in strat]
    idx = np.arange(len(X))
    tr_idx, tmp_idx = train_test_split(idx, test_size=0.3, random_state=SEED, stratify=strat_safe)
    tmp_strat = [strat_safe[i] for i in tmp_idx]
    tmp_counts: dict[str, int] = {}
    for s in tmp_strat:
        tmp_counts[s] = tmp_counts.get(s, 0) + 1
    tmp_strat = [s if tmp_counts[s] >= 2 else "rare" for s in tmp_strat]
    va_idx, te_idx = train_test_split(tmp_idx, test_size=0.5, random_state=SEED, stratify=tmp_strat)

    scaler = StandardScaler().fit(X[tr_idx])   # fitted on TRAIN ONLY
    Xs = scaler.transform(X).astype(np.float32)

    seqs = np.zeros((len(records), MAX_SEQ_LEN, len(EVENT_CHANNELS)), dtype=np.float32)
    types = np.zeros((len(records), MAX_SEQ_LEN), dtype=np.int64)
    has_seq = np.zeros(len(records), dtype=bool)
    for i, r in enumerate(records):
        if r.get("events"):
            s, t = encode_sequence(r["events"])
            seqs[i], types[i], has_seq[i] = np.asarray(s, dtype=np.float32), np.asarray(t), True

    splits = {"train": tr_idx, "validation": va_idx, "test": te_idx}
    results: dict[str, dict] = {}
    all_thresholds: dict[str, dict] = {}
    importances: dict[str, dict] = {}
    training_meta: dict[str, dict] = {}

    def finish(name: str, version: str, val_p: np.ndarray, get_p, meta: dict) -> None:
        sel = {t: thr.select(Y[va_idx][:, k], val_p[:, k]) for k, t in enumerate(TARGETS)}
        cut = {t: sel[t]["threshold"] for t in TARGETS}
        all_thresholds[version] = sel
        per_split = {}
        infer_ms = None
        for sname, sidx in splits.items():
            start = time.perf_counter()
            p = get_p(sidx)
            elapsed = (time.perf_counter() - start) * 1000
            if sname == "test":
                infer_ms = round(elapsed / max(1, len(sidx)), 4)
            per_split[sname] = evaluate(Y[sidx], p, cut)
        results[name] = {
            "model": name, "modelVersion": version, "splits": per_split,
            "inferenceMsPerSample": infer_ms, "thresholds": cut,
        }
        training_meta[name] = meta

    # 9. Train models.
    for kind in ("catboost", "lightgbm"):
        booster = MultiLabelBooster(kind, TARGETS)
        booster.fit(Xs[tr_idx], Y[tr_idx], Xs[va_idx], Y[va_idx])
        joblib.dump({"booster": booster, "scaler": scaler}, MODELS / f"{kind}.joblib")
        importances[MODEL_VERSIONS[kind]] = booster.feature_importance()
        finish(kind, MODEL_VERSIONS[kind], booster.predict_proba(Xs[va_idx]),
               lambda sidx, b=booster: b.predict_proba(Xs[sidx]),
               {"library": kind, "estimatorsPerDisorder": 400, "earlyStopping": True})

    attn, attn_meta = train_attention(Xs[tr_idx], Y[tr_idx], Xs[va_idx], Y[va_idx])
    torch.save(attn.state_dict(), MODELS / "attention.pt")
    importances[MODEL_VERSIONS["attention"]] = {
        "all_targets": attention_importance(attn, Xs[va_idx], FEATURES)
    }
    finish("attention", MODEL_VERSIONS["attention"], attn_proba(attn, Xs[va_idx]),
           lambda sidx: attn_proba(attn, Xs[sidx]),
           {"library": "pytorch", "architecture": "feature-token self-attention -> MLP -> 4 sigmoids", **attn_meta})

    seq_tr = tr_idx[has_seq[tr_idx]]
    seq_va = va_idx[has_seq[va_idx]]
    transformer = None
    if len(seq_tr) >= 200 and len(seq_va) >= 50:
        transformer, tmeta = train_transformer(
            (seqs[seq_tr], types[seq_tr], Xs[seq_tr], Y[seq_tr]),
            (seqs[seq_va], types[seq_va], Xs[seq_va], Y[seq_va]),
            n_task_types=len(TASK_TYPES) + 1,
        )
        torch.save(transformer.state_dict(), MODELS / "transformer.pt")
        finish("transformer", MODEL_VERSIONS["transformer"],
               tr_proba(transformer, seqs[seq_va], types[seq_va], Xs[seq_va]),
               lambda sidx: tr_proba(transformer, seqs[sidx], types[sidx], Xs[sidx]),
               {"library": "pytorch",
                "architecture": "2-layer TransformerEncoder, 4 heads, d_model 48, sinusoidal positional encoding, masked mean pooling + tabular fusion",
                "sequenceRows": {"train": int(len(seq_tr)), "validation": int(len(seq_va))}, **tmeta})
        # Sequence models are only evaluated on rows that actually carry sequences.
        results["transformer"]["evaluatedOn"] = "rows with event sequences only"
    else:
        results["transformer"] = {
            "model": "transformer", "modelVersion": MODEL_VERSIONS["transformer"],
            "status": "not available", "reason": "not enough rows carrying event sequences to train",
        }

    # 10-15. Persist artifacts.
    ranked = sorted(
        [r for r in results.values() if r.get("splits")],
        key=lambda r: (r["splits"]["validation"]["macro"]["rocAuc"] or 0), reverse=True,
    )
    production = ranked[0]["model"]
    joblib.dump(scaler, ARTIFACTS / "preprocessor.joblib")
    (ARTIFACTS / "thresholds.json").write_text(json.dumps(all_thresholds, indent=2))
    (ARTIFACTS / "feature_importance.json").write_text(json.dumps(importances, indent=2))
    (METRICS / "evaluation.json").write_text(json.dumps(results, indent=2))

    report = {
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "randomState": SEED,
        "datasetVersion": DATASET_VERSION,
        "featureVersion": FEATURE_VERSION,
        "features": FEATURES,
        "targets": TARGETS,
        "dataset": build_report.__dict__,
        "split": {
            "scheme": "stratified on multi-label pattern, 70/15/15",
            "train": int(len(tr_idx)), "validation": int(len(va_idx)), "test": int(len(te_idx)),
            "rowsWithSequences": int(has_seq.sum()),
        },
        "models": {k: {"modelVersion": v, "status": ("trained" if k in results and results[k].get("splits") else "not available")}
                   for k, v in MODEL_VERSIONS.items()},
        "productionModel": production,
        "productionModelVersion": results[production]["modelVersion"],
        "thresholdMethodology": thr.METHOD,
        "leakage": {"verdict": leak["verdict"], "removedCount": len(leak["removedFeatures"]),
                    "suspiciousCount": len(leak["suspiciousFeatures"]), "method": leak["method"]},
        "evaluation": results,
        "featureImportance": importances,
        "trainingMeta": training_meta,
        "wallClockSeconds": round(time.time() - t0, 1),
        "limitations": [
            "Training data is synthetic behavioural simulation unless public CSVs or labelled realtime rows are imported; counts by source are reported above.",
            "No clinical validation. Outputs are educational screening estimates, not diagnoses.",
            "Labels in the synthetic split come from the simulator's latent severity, so metrics measure recovery of that generative process, not clinical ground truth.",
            "The Transformer is evaluated only on rows that carry event sequences.",
        ],
    }
    (REPORTS / "model_report.json").write_text(json.dumps(report, indent=2))

    # 16. Export the browser fallback (attention-v1 runs in-app; the FastAPI
    # service can serve any of the four trained models).
    export_attention_to_ts(attn, scaler, report, all_thresholds[MODEL_VERSIONS["attention"]])

    print(json.dumps({
        "production": production,
        "datasetSources": build_report.counts_by_source,
        "testMacro": {k: v["splits"]["test"]["macro"] for k, v in results.items() if v.get("splits")},
    }, indent=2))


if __name__ == "__main__":
    main()
