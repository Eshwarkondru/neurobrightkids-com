"""Target-leakage analysis. Writes reports/leakage_report.json.

Two checks:
1. Name check — any candidate column whose name matches a forbidden pattern
   (diagnosis, risk, label, severity, disorder names ...) is removed. Those
   describe the outcome, not the child's behaviour.
2. Statistical check — a feature whose absolute point-biserial correlation with
   any target exceeds `CORR_LIMIT`, or that alone reaches near-perfect
   single-feature AUC, is flagged as suspicious (possible indirect leak).
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import roc_auc_score

from features import FEATURES, FORBIDDEN_FEATURE_PATTERNS, TARGETS

CORR_LIMIT = 0.95
AUC_LIMIT = 0.99


def analyse(X: np.ndarray, Y: np.ndarray, candidate_columns: list[str]) -> dict:
    removed = []
    for col in candidate_columns:
        low = col.lower()
        hit = next((p for p in FORBIDDEN_FEATURE_PATTERNS if p in low), None)
        if hit and col in candidate_columns and col not in FEATURES:
            removed.append({
                "feature": col,
                "reason": f"column name matches forbidden pattern '{hit}' (outcome/label information)",
            })

    suspicious = []
    per_feature: list[dict] = []
    for j, name in enumerate(FEATURES):
        col = X[:, j]
        entry: dict = {"feature": name, "max_abs_corr": 0.0, "max_single_feature_auc": 0.0}
        for k, t in enumerate(TARGETS):
            y = Y[:, k]
            if col.std() < 1e-12 or len(set(y.tolist())) < 2:
                continue
            corr = abs(float(np.corrcoef(col, y)[0, 1]))
            auc = float(roc_auc_score(y, col))
            auc = max(auc, 1 - auc)
            entry["max_abs_corr"] = round(max(entry["max_abs_corr"], corr), 4)
            entry["max_single_feature_auc"] = round(max(entry["max_single_feature_auc"], auc), 4)
            if corr > CORR_LIMIT or auc > AUC_LIMIT:
                suspicious.append({
                    "feature": name, "target": t,
                    "abs_corr": round(corr, 4), "single_feature_auc": round(auc, 4),
                    "reason": "near-deterministic relationship with the target — likely indirect leakage",
                })
        per_feature.append(entry)

    return {
        "method": (
            "Name-pattern exclusion of outcome columns + point-biserial correlation "
            f"and single-feature ROC-AUC screen (limits: |r|>{CORR_LIMIT}, AUC>{AUC_LIMIT})."
        ),
        "checkedFeatures": FEATURES,
        "checkedColumns": candidate_columns,
        "forbiddenPatterns": FORBIDDEN_FEATURE_PATTERNS,
        "removedFeatures": removed,
        "suspiciousFeatures": suspicious,
        "perFeature": per_feature,
        "modelInputsUsed": FEATURES,
        "verdict": "no leakage detected" if not suspicious else "review suspicious features",
    }
