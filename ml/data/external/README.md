# External (public) dataset imports

Real public datasets are **not** bundled with this repo. Drop CSV files here and
they are loaded with `source="public"` by `ml/dataset.py`.

```bash
cp ~/Downloads/my_public_dataset.csv ml/data/external/
python3 ml/train.py
```

## CSV schema

| column | required | meaning |
| --- | --- | --- |
| `student_id` | yes | opaque id — do NOT put names or emails here |
| `age` | yes | child age in years (3-20) |
| `accuracy` | yes | overall correctness 0..1 |
| `response_time_avg` | yes | mean seconds per item |
| `response_time_var` | yes | variance of per-item response time (s^2) |
| `reading_accuracy` | yes | 0..1 correctness on reading items |
| `phonics_accuracy` | yes | 0..1 correctness on phonics items |
| `writing_task_accuracy` | yes | 0..1 correctness on writing / letter-formation items |
| `number_operation_accuracy` | yes | 0..1 correctness on arithmetic / quantity items |
| `memory_score` | yes | 0..1 correctness on working-memory items |
| `attention_span` | yes | 0..1 longest sustained-correct run on attention items |
| `spelling_error_count` | yes | integer count |
| `mirror_letter_errors` | yes | integer count |
| `retry_frequency` | yes | retries per item |
| `incorrect_attempts` | yes | integer count |
| `total_attempts` | yes | integer count |
| `skipped_questions` | yes | integer count |
| `task_completion_rate` | yes | 0..1 |
| `game_completion_time` | yes | seconds of on-task time |
| `distraction_events` | yes | integer count of attention lapses |
| `label_dyslexia` | yes | 0/1 elevated-risk label (screening outcome, never a model input) |
| `label_dysgraphia` | yes | 0/1 |
| `label_dyscalculia` | yes | 0/1 |
| `label_adhd` | yes | 0/1 |
| `source_name` | no | free text provenance, e.g. 'OULAD' (optional) |
| `events_json` | no | optional JSON array of raw events; enables the Transformer on this row |

Notes
- `student_id` must be an opaque id — never a name or email.
- `label_*` columns are screening outcome labels. They are targets, never model
  inputs; `ml/leakage.py` rejects any input column that looks like an outcome.
- `events_json` is optional. Rows that include it also train the Transformer
  sequence model; rows without it train the tabular models only.
- Rows with missing/invalid values or duplicate feature vectors are dropped and
  counted in `ml/data/processed/build_report.json`.
