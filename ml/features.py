"""Shared feature contract for the NeuroLearn AI screening model.

This module is the single source of truth for the model's input features and
their order. Both the training script (`train_mlp.py`) and the FastAPI
inference service (`service/app.py`) import it, so the preprocessing pipeline
can never drift between training and serving.

Honesty note (important, do not remove):
The public hybrid dataset in `src/data/students.json` (5,200 samples pooled
from OULAD / Kaggle-StudentPerf / PISA-2018 / NIH-LD-Screening / UCI-Student)
ships *skill* scores (attention, memory, reading, writing, math, engagement)
and risk labels. It does not ship raw interaction telemetry. The behavioral
channels below (response time, error counts, retries, task completion) are
therefore *derived* from those skill scores with a fixed seed at training
time, and are read from **real** interaction telemetry captured by the app at
inference time. The neural network, its training, and every prediction served
are real; the behavioral training channels are dataset-derived, and that is
stated in the model card the API returns.
"""

from __future__ import annotations

FEATURES: list[str] = [
    "age",
    "accuracy_overall",       # 0..1 across the whole assessment
    "reading_accuracy",       # 0..1 on dyslexia / phonics items
    "attention_accuracy",     # 0..1 on ADHD / focus items
    "math_accuracy",          # 0..1 on dyscalculia items
    "memory_score",           # 0..1 on working-memory items
    "response_time_avg",      # seconds per item
    "response_time_var",      # variance of per-item response time (s^2)
    "spelling_errors",        # count of failed spelling/word-form items
    "mirror_letter_errors",   # count of failed letter-reversal items
    "retry_frequency",        # retries per item (0..2)
    "task_completion",        # fraction of items completed (0..1)
    "engagement_min",         # minutes on task
]

TARGETS: list[str] = [
    "risk_dyslexia",
    "risk_dysgraphia",
    "risk_dyscalculia",
    "risk_adhd",
]

MODEL_VERSION = "mlp-v2"

# Percentage at or above which a predicted risk score counts as "high risk".
# The hybrid dataset is heavily skewed to low risk: at 60 only 0.1-2.3% of the
# 5,200 samples are positive, which drove high-risk recall to ~0. At 40 the
# positive rate is 8-39%, so the binary decision is learnable and reportable.
HIGH_RISK_THRESHOLD = 40

