"""Documented synthetic behavioural simulator (source = "synthetic").

This is NOT clinical data and NOT a public dataset. It is a generative model of
child gameplay behaviour used to bootstrap training when no real data is
supplied. The generative story is explicit so it can be judged:

1. Each simulated child draws a latent severity in [0, 1] per category
   (dyslexia, dysgraphia, dyscalculia, adhd) plus a general-ability factor.
2. The child plays a sequence of 18-24 adaptive items across task types.
   Correctness probability for an item depends on the general factor, the
   severity of the category that task type loads on, item difficulty and age.
3. Response time, retries, skips and mirror/spelling slips are sampled from
   distributions conditioned on the same latents (ADHD severity widens the
   response-time distribution; dyslexia severity drives mirror-letter slips;
   dysgraphia severity drives spelling slips).
4. Difficulty adapts within the session exactly like the app's adaptive games:
   up after two correct, down after an error.
5. The label is drawn from the latent severity with label noise. Labels are
   never written into the feature vector, so the features the model sees are
   only behavioural observations.
"""

from __future__ import annotations

import numpy as np

from features import TASK_TYPES, engineer_features

TASK_LOADING: dict[str, list[str]] = {
    "reading": ["dyslexia"],
    "phonics": ["dyslexia"],
    "writing": ["dysgraphia"],
    "math": ["dyscalculia"],
    "memory": ["dyslexia", "adhd"],
    "attention": ["adhd"],
    "shape": ["dysgraphia", "dyscalculia"],
}
LABEL_CUT = 0.55
LABEL_NOISE = 0.06


def simulate_child(rng: np.random.Generator, idx: int) -> dict:
    age = float(rng.integers(6, 17))
    ability = float(np.clip(rng.normal(0.65, 0.16), 0.15, 0.98))
    # Correlated severities: comorbidity is common, so share a latent factor.
    shared = float(rng.beta(2.0, 5.0))
    sev = {
        t: float(np.clip(0.55 * shared + 0.45 * rng.beta(2.0, 4.5), 0.0, 1.0))
        for t in ("dyslexia", "dysgraphia", "dyscalculia", "adhd")
    }

    n_items = int(rng.integers(18, 25))
    order = [TASK_TYPES[i % len(TASK_TYPES)] for i in range(n_items)]
    rng.shuffle(order)

    difficulty = 0.45
    correct_run = 0
    events: list[dict] = []
    for i, task in enumerate(order):
        load = float(np.mean([sev[d] for d in TASK_LOADING[task]]))
        age_bonus = (age - 6) / 20.0
        p_correct = float(np.clip(
            0.15 + 0.75 * ability - 0.8 * load - 0.35 * (difficulty - 0.45) + 0.15 * age_bonus,
            0.03, 0.97,
        ))
        correct = bool(rng.random() < p_correct)

        base_rt = 3.0 + 7.0 * load + 4.0 * difficulty - 2.0 * ability
        jitter = rng.lognormal(0.0, 0.35 + 0.55 * sev["adhd"])
        rt = float(np.clip(base_rt * jitter, 0.6, 60.0))

        retries = int(rng.binomial(3, np.clip(0.10 + 0.45 * load, 0, 0.9))) if not correct else 0
        skipped = bool(rng.random() < 0.02 + 0.12 * sev["adhd"] * difficulty)
        completed = not skipped and rng.random() > 0.02 * (1 + sev["adhd"])
        mirror = bool(task in ("reading", "phonics") and not correct and rng.random() < 0.35 + 0.5 * sev["dyslexia"])
        spelling = bool(task in ("writing", "phonics") and not correct and rng.random() < 0.30 + 0.5 * sev["dysgraphia"])

        events.append({
            "order": i,
            "task_type": task,
            "difficulty": round(difficulty, 3),
            "correct": correct and not skipped,
            "response_time": round(rt, 3),
            "retries": retries,
            "skipped": skipped,
            "completed": completed,
            "mirror_error": mirror,
            "spelling_error": spelling,
        })

        # Adaptive difficulty (same rule the games use).
        if correct and not skipped:
            correct_run += 1
            if correct_run >= 2:
                difficulty = float(min(1.0, difficulty + 0.12))
                correct_run = 0
        else:
            correct_run = 0
            difficulty = float(max(0.1, difficulty - 0.15))

    labels = {}
    for t, s in sev.items():
        p = 1 / (1 + np.exp(-(s - LABEL_CUT) / 0.09))
        p = float(np.clip(p * (1 - LABEL_NOISE) + LABEL_NOISE * rng.random(), 0, 1))
        labels[t] = int(rng.random() < p)

    return {
        "student_id": f"sim-{idx:06d}",
        "features": engineer_features(events, age),
        "labels": labels,
        "events": events,
        "source": "synthetic",
        "source_name": "neurolearn-simulator-v1",
    }


def simulate(n: int, seed: int = 42) -> list[dict]:
    rng = np.random.default_rng(seed)
    return [simulate_child(rng, i) for i in range(n)]
