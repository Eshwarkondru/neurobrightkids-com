"""Gradient-boosting models: CatBoost and LightGBM (one binary model per disorder)."""

from __future__ import annotations

import numpy as np

from features import FEATURES

SEED = 42


class MultiLabelBooster:
    """One binary classifier per disorder -> independent probabilities."""

    def __init__(self, kind: str, targets: list[str]):
        self.kind = kind
        self.targets = targets
        self.models: dict[str, object] = {}

    def _make(self):
        if self.kind == "catboost":
            from catboost import CatBoostClassifier
            return CatBoostClassifier(
                iterations=400, depth=6, learning_rate=0.06, l2_leaf_reg=3.0,
                loss_function="Logloss", eval_metric="AUC", random_seed=SEED,
                verbose=False, allow_writing_files=False,
            )
        if self.kind == "lightgbm":
            from lightgbm import LGBMClassifier
            return LGBMClassifier(
                n_estimators=400, num_leaves=31, learning_rate=0.06,
                subsample=0.9, subsample_freq=1, colsample_bytree=0.9,
                random_state=SEED, verbosity=-1,
            )
        raise ValueError(f"unknown booster {self.kind}")

    def fit(self, X: np.ndarray, Y: np.ndarray, Xv: np.ndarray, Yv: np.ndarray) -> None:
        for k, t in enumerate(self.targets):
            model = self._make()
            if self.kind == "catboost":
                model.fit(X, Y[:, k], eval_set=(Xv, Yv[:, k]), early_stopping_rounds=40)
            else:
                from lightgbm import early_stopping, log_evaluation
                model.fit(
                    X, Y[:, k], eval_set=[(Xv, Yv[:, k])], eval_metric="auc",
                    callbacks=[early_stopping(40, verbose=False), log_evaluation(0)],
                )
            self.models[t] = model

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        return np.column_stack([
            self.models[t].predict_proba(X)[:, 1] for t in self.targets
        ])

    def feature_importance(self) -> dict[str, dict[str, float]]:
        out: dict[str, dict[str, float]] = {}
        for t, model in self.models.items():
            raw = np.asarray(
                model.get_feature_importance() if self.kind == "catboost"
                else model.feature_importances_, dtype=float
            )
            total = raw.sum() or 1.0
            out[t] = {f: round(float(v / total), 5) for f, v in zip(FEATURES, raw)}
        return out
