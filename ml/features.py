"""Feature contract for NeuroLearn AI — single source of truth.

Training (`ml/train.py`), the FastAPI service (`ml/service/app.py`) and the
exported in-browser fallback all import this module, so the preprocessing used
at inference is byte-for-byte the preprocessing used at training.

Honesty note (do not remove):
- The bundled dataset in `ml/data/processed/` is **synthetic**: it is produced
  by the documented behavioural simulator in `ml/simulate.py`. It is not
  clinical data and is not a public research dataset.
- Real public datasets can be imported as CSV into `ml/data/external/`
  (schema: `ml/data_schema.py`, docs: `ml/data/external/README.md`). Rows
  imported that way carry `source="public"`.
- Live app telemetry exported into `ml/data/realtime/` carries
  `source="realtime"`.
Every row in the training frame carries its `source`, and the research page
reports the per-source counts that actually went into the trained model.
"""

from __future__ import annotations

import math
from typing import Any, Iterable, Sequence

FEATURE_VERSION = "features-v3"
DATASET_VERSION = "dataset-v3"

# ---------------------------------------------------------------------------
# Model-ready feature vector (order matters — never reorder, only append)
# ---------------------------------------------------------------------------
FEATURES: list[str] = [
    "age",
    "accuracy",                      # overall correctness 0..1
    "response_time_avg",             # seconds per item
    "response_time_var",             # variance of per-item response time (s^2)
    "reading_accuracy",              # 0..1 on reading items
    "phonics_accuracy",              # 0..1 on phonics items
    "writing_task_accuracy",         # 0..1 on writing/letter-formation items
    "number_operation_accuracy",     # 0..1 on arithmetic / quantity items
    "memory_score",                  # 0..1 on working-memory items
    "attention_span",                # longest correct streak on attention items / items
    "spelling_error_count",          # count
    "mirror_letter_errors",          # count
    "retry_frequency",               # retries per item
    "incorrect_attempts",            # count
    "total_attempts",                # count
    "skipped_questions",             # count
    "task_completion_rate",          # 0..1
    "game_completion_time",          # seconds of on-task time
    "distraction_events",            # long-pause / timeout style lapses
]

TARGETS: list[str] = ["dyslexia", "dysgraphia", "dyscalculia", "adhd"]

# Task types that behavioural events can carry.
TASK_TYPES: list[str] = [
    "reading", "phonics", "writing", "math", "memory", "attention", "shape",
]

# Features that must never be used as model input (target leakage guards).
FORBIDDEN_FEATURE_PATTERNS: list[str] = [
    "risk", "diagnos", "label", "target", "severity", "disorder",
    "dyslexia", "dysgraphia", "dyscalculia", "adhd", "outcome", "prognos",
]

MODEL_VERSIONS: dict[str, str] = {
    "catboost": "catboost-v1",
    "lightgbm": "lightgbm-v1",
    "attention": "attention-v1",
    "transformer": "transformer-v1",
}

# Sequence encoding for the Transformer: per-event numeric channels.
EVENT_CHANNELS: list[str] = [
    "response_time_norm",   # response time / 20s, clipped
    "correct",              # 1 / 0
    "retry_count_norm",     # retries / 3, clipped
    "difficulty",           # 0..1
    "completed",            # 1 / 0
    "skipped",              # 1 / 0
]
MAX_SEQ_LEN = 24


def _f(value: Any, default: float = 0.0) -> float:
    try:
        out = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(out) or math.isinf(out):
        return default
    return out


def engineer_features(events: Sequence[dict], age: float) -> dict[str, float]:
    """Turn raw interaction events into the model-ready feature dict.

    An event is a dict with keys: task_type, correct, response_time, retries,
    skipped, completed, difficulty, mirror_error, spelling_error.
    This exact function is used by the trainer (on simulated / imported
    sequences) and by the API at inference (on real gameplay events).
    """
    evs = [e for e in events if isinstance(e, dict)]
    n = len(evs)
    if n == 0:
        return {f: 0.0 for f in FEATURES} | {"age": _f(age, 10.0)}

    rts = [max(0.05, _f(e.get("response_time"), 5.0)) for e in evs]
    rt_avg = sum(rts) / n
    rt_var = sum((r - rt_avg) ** 2 for r in rts) / n
    correct = [1.0 if e.get("correct") else 0.0 for e in evs]
    skipped = sum(1.0 for e in evs if e.get("skipped"))
    retries = sum(_f(e.get("retries"), 0.0) for e in evs)

    def acc_of(kinds: Iterable[str]) -> float:
        ks = set(kinds)
        sub = [c for c, e in zip(correct, evs) if e.get("task_type") in ks]
        return sum(sub) / len(sub) if sub else 0.0

    # Attention span: longest run of correct, on-time attention/focus events.
    streak = best = 0
    for c, e in zip(correct, evs):
        if e.get("task_type") in {"attention", "shape"}:
            if c and _f(e.get("response_time"), 5.0) <= rt_avg * 1.5:
                streak += 1
                best = max(best, streak)
            else:
                streak = 0
    attention_items = sum(1 for e in evs if e.get("task_type") in {"attention", "shape"}) or 1

    # A "distraction event" is a response far slower than the child's own pace,
    # or an abandoned item — the behavioural proxy for an attention lapse.
    distraction = sum(
        1.0 for e, r in zip(evs, rts)
        if r > rt_avg + 2 * math.sqrt(rt_var + 1e-9) or e.get("skipped") or not e.get("completed", True)
    )

    out = {
        "age": _f(age, 10.0),
        "accuracy": sum(correct) / n,
        "response_time_avg": round(rt_avg, 4),
        "response_time_var": round(rt_var, 4),
        "reading_accuracy": acc_of(["reading"]),
        "phonics_accuracy": acc_of(["phonics"]),
        "writing_task_accuracy": acc_of(["writing"]),
        "number_operation_accuracy": acc_of(["math"]),
        "memory_score": acc_of(["memory"]),
        "attention_span": best / attention_items,
        "spelling_error_count": sum(1.0 for e in evs if e.get("spelling_error")),
        "mirror_letter_errors": sum(1.0 for e in evs if e.get("mirror_error")),
        "retry_frequency": retries / n,
        "incorrect_attempts": n - sum(correct),
        "total_attempts": float(n) + retries,
        "skipped_questions": skipped,
        "task_completion_rate": sum(1.0 for e in evs if e.get("completed", True)) / n,
        "game_completion_time": round(sum(rts), 3),
        "distraction_events": distraction,
    }
    return {f: round(_f(out.get(f)), 6) for f in FEATURES}


def vectorize(features: dict[str, float]) -> list[float]:
    """Feature dict -> ordered vector (missing values become 0)."""
    return [_f(features.get(f), 0.0) for f in FEATURES]


def encode_sequence(events: Sequence[dict], max_len: int = MAX_SEQ_LEN) -> tuple[list[list[float]], list[int]]:
    """Events -> (padded channel matrix, task-type ids) for the Transformer."""
    rows: list[list[float]] = []
    types: list[int] = []
    for e in list(events)[:max_len]:
        rows.append([
            min(1.0, max(0.0, _f(e.get("response_time"), 5.0) / 20.0)),
            1.0 if e.get("correct") else 0.0,
            min(1.0, _f(e.get("retries"), 0.0) / 3.0),
            min(1.0, max(0.0, _f(e.get("difficulty"), 0.5))),
            1.0 if e.get("completed", True) else 0.0,
            1.0 if e.get("skipped") else 0.0,
        ])
        tt = e.get("task_type")
        types.append(TASK_TYPES.index(tt) + 1 if tt in TASK_TYPES else 0)
    while len(rows) < max_len:
        rows.append([0.0] * len(EVENT_CHANNELS))
        types.append(0)  # 0 == padding / unknown task
    return rows, types
