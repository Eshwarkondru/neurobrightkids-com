"""Dataset pipeline: synthetic + public (CSV import) + realtime records.

Every record carries a `source` of "synthetic", "public" or "realtime". The
trainer reports the per-source counts that actually entered the model, so the
research page never has to guess (or invent) provenance.

Layout
------
ml/data/raw/        untouched inputs you drop in (any format, for your notes)
ml/data/external/   public-dataset CSV imports  -> source="public"
ml/data/realtime/   exported live app telemetry -> source="realtime"
ml/data/processed/  the built training frame (JSONL, reproducible)
"""

from __future__ import annotations

import json
import pathlib
from dataclasses import dataclass, field

from data_schema import EVENTS_COLUMN, SchemaError, coerce_row, read_csv
from features import DATASET_VERSION, FEATURES, TARGETS
from simulate import simulate

ROOT = pathlib.Path(__file__).resolve().parent
DATA = ROOT / "data"
DIRS = {k: DATA / k for k in ("raw", "processed", "external", "realtime")}


@dataclass
class BuildReport:
    dataset_version: str = DATASET_VERSION
    requested_synthetic: int = 0
    counts_by_source: dict[str, int] = field(default_factory=dict)
    source_names: dict[str, int] = field(default_factory=dict)
    dropped_invalid: int = 0
    dropped_duplicate: int = 0
    dropped_missing: int = 0
    files_read: list[str] = field(default_factory=list)
    schema_errors: list[str] = field(default_factory=list)
    rows_with_sequences: int = 0
    total: int = 0
    label_positive_rate: dict[str, float] = field(default_factory=dict)


def _ensure_dirs() -> None:
    for d in DIRS.values():
        d.mkdir(parents=True, exist_ok=True)


def _load_external(report: BuildReport) -> list[dict]:
    rows: list[dict] = []
    for path in sorted(DIRS["external"].glob("*.csv")):
        try:
            raw_rows = list(read_csv(path))
        except SchemaError as exc:
            report.schema_errors.append(f"{path.name}: {exc}")
            continue
        report.files_read.append(str(path.relative_to(ROOT)))
        for raw in raw_rows:
            rec = coerce_row(raw)
            if rec is None:
                report.dropped_missing += 1
                continue
            ev = rec.pop("events_json", "")
            if ev:
                try:
                    rec["events"] = json.loads(ev)
                except json.JSONDecodeError:
                    rec["events"] = []
            rows.append(rec)
    return rows


def _load_realtime(report: BuildReport) -> list[dict]:
    """JSONL exports of real sessions: {student_id, age, events, labels?}."""
    rows: list[dict] = []
    for path in sorted(DIRS["realtime"].glob("*.jsonl")):
        report.files_read.append(str(path.relative_to(ROOT)))
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                report.dropped_invalid += 1
                continue
            labels = rec.get("labels")
            # Unlabelled live sessions cannot be used for supervised training.
            if not isinstance(labels, dict) or any(t not in labels for t in TARGETS):
                report.dropped_missing += 1
                continue
            feats = rec.get("features")
            if not isinstance(feats, dict) or any(f not in feats for f in FEATURES):
                report.dropped_missing += 1
                continue
            rows.append({
                "student_id": rec.get("student_id"),
                "features": {f: float(feats[f]) for f in FEATURES},
                "labels": {t: int(labels[t]) for t in TARGETS},
                "events": rec.get("events") or [],
                "source": "realtime",
                "source_name": rec.get("source_name") or "app-telemetry",
            })
    return rows


def build(n_synthetic: int = 5200, seed: int = 42, write: bool = True) -> tuple[list[dict], BuildReport]:
    _ensure_dirs()
    report = BuildReport(requested_synthetic=n_synthetic)

    records = _load_external(report) + _load_realtime(report)
    records += simulate(n_synthetic, seed=seed)

    # Deduplicate on the rounded feature vector (guards against re-imported CSVs).
    seen: set[tuple] = set()
    clean: list[dict] = []
    for rec in records:
        feats = rec["features"]
        if any(f not in feats for f in FEATURES):
            report.dropped_invalid += 1
            continue
        key = tuple(round(float(feats[f]), 4) for f in FEATURES)
        if key in seen:
            report.dropped_duplicate += 1
            continue
        seen.add(key)
        clean.append(rec)

    for rec in clean:
        report.counts_by_source[rec["source"]] = report.counts_by_source.get(rec["source"], 0) + 1
        name = rec.get("source_name") or rec["source"]
        report.source_names[name] = report.source_names.get(name, 0) + 1
        if rec.get("events"):
            report.rows_with_sequences += 1
    report.total = len(clean)
    for t in TARGETS:
        report.label_positive_rate[t] = round(
            sum(r["labels"][t] for r in clean) / max(1, len(clean)), 4
        )

    if write:
        out = DIRS["processed"] / "training_frame.jsonl"
        with out.open("w", encoding="utf-8") as fh:
            for rec in clean:
                fh.write(json.dumps(rec, separators=(",", ":")) + "\n")
        (DIRS["processed"] / "build_report.json").write_text(
            json.dumps(report.__dict__, indent=2)
        )
    return clean, report


if __name__ == "__main__":
    _, rep = build()
    print(json.dumps(rep.__dict__, indent=2))
