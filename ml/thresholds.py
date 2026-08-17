"""Decision-threshold selection on the VALIDATION set (never on test).

Methodology (also surfaced verbatim in the app's research page):
  For each disorder we sweep candidate thresholds 0.05..0.95 (step 0.01) on
  validation probabilities and pick the threshold that maximises F1 among the
  candidates that reach a minimum recall of MIN_RECALL. Screening favours
  sensitivity: missing an elevated-risk child is costlier than a false alarm
  that leads to one extra practice session. If no candidate reaches the recall
  floor, the highest-recall candidate is chosen and flagged.

Selected thresholds are stored in artifacts/thresholds.json and applied at
inference — the app never hardcodes 0.5.
"""

from __future__ import annotations

import numpy as np
from sklearn.metrics import f1_score, precision_score, recall_score

MIN_RECALL = 0.60
METHOD = (
    "Threshold selected on the validation split by F1 maximisation subject to a "
    f"minimum recall floor of {MIN_RECALL:.2f} (screening-oriented sensitivity analysis). "
    "No clinical validity is claimed."
)


def select(y_true: np.ndarray, proba: np.ndarray) -> dict:
    grid = np.arange(0.05, 0.96, 0.01)
    rows = []
    for t in grid:
        pred = (proba >= t).astype(int)
        rows.append({
            "threshold": round(float(t), 3),
            "precision": round(float(precision_score(y_true, pred, zero_division=0)), 4),
            "recall": round(float(recall_score(y_true, pred, zero_division=0)), 4),
            "f1": round(float(f1_score(y_true, pred, zero_division=0)), 4),
        })
    eligible = [r for r in rows if r["recall"] >= MIN_RECALL]
    if eligible:
        best = max(eligible, key=lambda r: (r["f1"], r["recall"]))
        note = "F1-optimal among thresholds meeting the recall floor"
    else:
        best = max(rows, key=lambda r: (r["recall"], r["f1"]))
        note = f"recall floor {MIN_RECALL} unreachable on validation — highest-recall threshold used"
    return {
        "threshold": best["threshold"],
        "validation": {k: best[k] for k in ("precision", "recall", "f1")},
        "note": note,
        "method": METHOD,
        "minRecallFloor": MIN_RECALL,
        "sweep": rows[::5],
    }
