"""Attention-based neural network over the tabular feature vector (PyTorch).

Architecture (attention-v1):
  each of the 19 features is embedded into a d-dim token -> single-head
  self-attention across feature tokens -> attention-weighted pooling ->
  MLP head -> 4 independent sigmoid outputs (multi-label).

The learned attention weights are real and are exported as per-feature
attention importance. Feature tokens make the attention interpretable:
weight[i] is how much the network attends to feature i.
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn

SEED = 42


class FeatureAttentionNet(nn.Module):
    def __init__(self, n_features: int, n_targets: int, d_model: int = 32, hidden: int = 64):
        super().__init__()
        self.n_features = n_features
        self.d_model = d_model
        # Per-feature linear embedding: value -> token (weight + bias per feature).
        self.embed_w = nn.Parameter(torch.randn(n_features, d_model) * 0.15)
        self.embed_b = nn.Parameter(torch.zeros(n_features, d_model))
        self.q = nn.Linear(d_model, d_model)
        self.k = nn.Linear(d_model, d_model)
        self.v = nn.Linear(d_model, d_model)
        self.norm = nn.LayerNorm(d_model)
        self.head = nn.Sequential(
            nn.Linear(d_model, hidden), nn.ReLU(), nn.Dropout(0.1), nn.Linear(hidden, n_targets)
        )

    def forward(self, x: torch.Tensor, return_attn: bool = False):
        # x: (B, F) -> tokens (B, F, d)
        tok = x.unsqueeze(-1) * self.embed_w + self.embed_b
        q, k, v = self.q(tok), self.k(tok), self.v(tok)
        scores = (q @ k.transpose(1, 2)) / (self.d_model ** 0.5)
        attn = torch.softmax(scores, dim=-1)          # (B, F, F)
        ctx = self.norm(attn @ v + tok)               # residual + norm
        pooled_w = attn.mean(dim=1)                   # (B, F) attention over features
        pooled = (ctx * pooled_w.unsqueeze(-1)).sum(dim=1)
        logits = self.head(pooled)
        return (logits, pooled_w) if return_attn else logits


def train_attention(
    Xtr: np.ndarray, Ytr: np.ndarray, Xv: np.ndarray, Yv: np.ndarray,
    epochs: int = 220, lr: float = 2e-3,
) -> tuple[FeatureAttentionNet, dict]:
    torch.manual_seed(SEED)
    np.random.seed(SEED)
    model = FeatureAttentionNet(Xtr.shape[1], Ytr.shape[1])
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    # Positive weighting keeps rare elevated-risk labels learnable.
    pos = Ytr.sum(axis=0).clip(1)
    pos_weight = torch.tensor((len(Ytr) - pos) / pos, dtype=torch.float32).clamp(1.0, 8.0)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    xt, yt = torch.tensor(Xtr, dtype=torch.float32), torch.tensor(Ytr, dtype=torch.float32)
    xv, yv = torch.tensor(Xv, dtype=torch.float32), torch.tensor(Yv, dtype=torch.float32)
    best, best_state, patience = float("inf"), None, 0
    history: list[dict] = []
    bs = 128
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(xt))
        for i in range(0, len(xt), bs):
            idx = perm[i:i + bs]
            opt.zero_grad()
            loss = loss_fn(model(xt[idx]), yt[idx])
            loss.backward()
            opt.step()
        model.eval()
        with torch.no_grad():
            vl = float(loss_fn(model(xv), yv))
        history.append({"epoch": ep + 1, "val_loss": round(vl, 5)})
        if vl < best - 1e-4:
            best, patience = vl, 0
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        else:
            patience += 1
            if patience >= 30:
                break
    if best_state:
        model.load_state_dict(best_state)
    model.eval()
    return model, {"epochs_run": len(history), "best_val_loss": round(best, 5), "history": history[-20:]}


def proba(model: FeatureAttentionNet, X: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        return torch.sigmoid(model(torch.tensor(X, dtype=torch.float32))).numpy()


def attention_importance(model: FeatureAttentionNet, X: np.ndarray, feature_names: list[str]) -> dict[str, float]:
    with torch.no_grad():
        _, w = model(torch.tensor(X, dtype=torch.float32), return_attn=True)
    mean = w.mean(dim=0).numpy()
    total = float(mean.sum()) or 1.0
    return {f: round(float(v / total), 5) for f, v in zip(feature_names, mean)}
