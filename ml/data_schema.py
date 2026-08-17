"""CSV import schema for external (public) datasets.

Real public educational datasets are NOT bundled with this repository. Drop
CSV files that match this schema into `ml/data/external/` and they are picked
up by `ml/dataset.py` with `source="public"`.
"""

from __future__ import annotations

import csv
import math
import pathlib
from typing import Iterator

from features import FEATURES, TARGETS

# Required columns for a tabular import: the engineered features plus the four
# binary labels. Sequence-level imports are optional (see EVENTS_COLUMN).
REQUIRED_COLUMNS: list[str] = ["student_id", "age", *[f for f in FEATURES if f != "age"]]
LABEL_COLUMNS: list[str] = [f"label_{t}" for t in TARGETS]
OPTIONAL_COLUMNS: list[str] = ["source_name", "events_json"]
EVENTS_COLUMN = "events_json"

COLUMN_DOC: dict[str, str] = {
    "student_id": "opaque id — do NOT put names or emails here",
    "age": "child age in years (3-20)",
    "accuracy": "overall correctness 0..1",
    "response_time_avg": "mean seconds per item",
    "response_time_var": "variance of per-item response time (s^2)",
    "reading_accuracy": "0..1 correctness on reading items",
    "phonics_accuracy": "0..1 correctness on phonics items",
    "writing_task_accuracy": "0..1 correctness on writing / letter-formation items",
    "number_operation_accuracy": "0..1 correctness on arithmetic / quantity items",
    "memory_score": "0..1 correctness on working-memory items",
    "attention_span": "0..1 longest sustained-correct run on attention items",
    "spelling_error_count": "integer count",
    "mirror_letter_errors": "integer count",
    "retry_frequency": "retries per item",
    "incorrect_attempts": "integer count",
    "total_attempts": "integer count",
    "skipped_questions": "integer count",
    "task_completion_rate": "0..1",
    "game_completion_time": "seconds of on-task time",
    "distraction_events": "integer count of attention lapses",
    "label_dyslexia": "0/1 elevated-risk label (screening outcome, never a model input)",
    "label_dysgraphia": "0/1",
    "label_dyscalculia": "0/1",
    "label_adhd": "0/1",
    "source_name": "free text provenance, e.g. 'OULAD' (optional)",
    "events_json": "optional JSON array of raw events; enables the Transformer on this row",
}


class SchemaError(Exception):
    pass


def validate_header(header: list[str]) -> None:
    missing = [c for c in REQUIRED_COLUMNS + LABEL_COLUMNS if c not in header]
    if missing:
        raise SchemaError(f"missing required columns: {missing}")


def read_csv(path: pathlib.Path) -> Iterator[dict]:
    with path.open(newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        validate_header(list(reader.fieldnames or []))
        for row in reader:
            yield row


def coerce_row(row: dict) -> dict | None:
    """Validate + coerce one CSV row. Returns None when the row is unusable."""
    try:
        feats = {}
        for f in FEATURES:
            raw = row.get(f, "")
            if raw is None or str(raw).strip() == "":
                return None  # missing value -> dropped by the trainer's report
            val = float(raw)
            if math.isnan(val) or math.isinf(val):
                return None
            feats[f] = val
        labels = {}
        for t in TARGETS:
            val = str(row.get(f"label_{t}", "")).strip()
            if val == "":
                return None
            labels[t] = 1 if float(val) >= 0.5 else 0
    except (TypeError, ValueError):
        return None
    if not (3 <= feats["age"] <= 20):
        return None
    return {
        "student_id": str(row.get("student_id", "")).strip() or None,
        "features": feats,
        "labels": labels,
        "source": "public",
        "source_name": (row.get("source_name") or "external-csv").strip(),
        "events_json": row.get(EVENTS_COLUMN) or "",
    }


def schema_markdown() -> str:
    lines = ["| column | required | meaning |", "| --- | --- | --- |"]
    for col, doc in COLUMN_DOC.items():
        req = "yes" if col in REQUIRED_COLUMNS + LABEL_COLUMNS else "no"
        lines.append(f"| `{col}` | {req} | {doc} |")
    return "\n".join(lines)


if __name__ == "__main__":
    print(schema_markdown())
