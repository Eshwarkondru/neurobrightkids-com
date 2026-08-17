"""Transformer encoder over the child's behavioural event SEQUENCE (PyTorch).

transformer-v1 — this is a genuine Transformer, not a renamed tree model:
  input  : (B, T, C) per-event channels (response time, correct, retries,
           difficulty, completed, skipped) + task-type embedding + sinusoidal
           positional encoding
  encoder: nn.TransformerEncoder, 2 layers, 4 heads, d_model 48, GELU
  pooling: masked mean over real (non-padded) events
  head   : concat(sequence summary, tabular feature vector) -> 4 sigmoids

Padding is masked, so short sessions are handled correctly. The sequence branch
sees the ORDER of behaviour (fatigue, drift, streaks), which the tabular models
cannot see.
"""

from __future__ import annotations

import math

import numpy as np
import torch
import torch.nn as nn

SEED = 42


class PositionalEncoding(nn.Module):
    def __init__(self, d_model: int, max_len: int = 64):
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        pos = torch.arange(max_len).unsqueeze(1).float()
        div = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(pos * div)
        pe[:, 1::2] = torch.cos(pos * div)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.pe[:, : x.size(1)]


class BehaviorTransformer(nn.Module):
    def __init__(self, n_channels: int, n_task_types: int, n_tabular: int, n_targets: int,
                 d_model: int = 48, nhead: int = 4, layers: int = 2):
        super().__init__()
        self.proj = nn.Linear(n_channels, d_model)
        self.task_emb = nn.Embedding(n_task_types, d_model, padding_idx=0)
        self.pos = PositionalEncoding(d_model)
        enc_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 4,
            dropout=0.1, activation="gelu", batch_first=True, norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(enc_layer, num_layers=layers)
        self.head = nn.Sequential(
            nn.Linear(d_model + n_tabular, 64), nn.GELU(), nn.Dropout(0.1), nn.Linear(64, n_targets)
        )

    def forward(self, seq: torch.Tensor, types: torch.Tensor, tab: torch.Tensor) -> torch.Tensor:
        pad_mask = types.eq(0)                                     # (B, T) True = padding
        h = self.pos(self.proj(seq) + self.task_emb(types))
        h = self.encoder(h, src_key_padding_mask=pad_mask)
        keep = (~pad_mask).unsqueeze(-1).float()
        summary = (h * keep).sum(dim=1) / keep.sum(dim=1).clamp(min=1.0)
        return self.head(torch.cat([summary, tab], dim=-1))


def train_transformer(
    tr: tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
    va: tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
    n_task_types: int, epochs: int = 120, lr: float = 2e-3,
) -> tuple[BehaviorTransformer, dict]:
    torch.manual_seed(SEED)
    Str, Ttr, Xtr, Ytr = tr
    Sv, Tv, Xv, Yv = va
    model = BehaviorTransformer(Str.shape[2], n_task_types, Xtr.shape[1], Ytr.shape[1])
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    pos = Ytr.sum(axis=0).clip(1)
    pos_weight = torch.tensor((len(Ytr) - pos) / pos, dtype=torch.float32).clamp(1.0, 8.0)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    def tt(a, dtype=torch.float32):
        return torch.tensor(a, dtype=dtype)

    str_, ttr_, xtr_, ytr_ = tt(Str), tt(Ttr, torch.long), tt(Xtr), tt(Ytr)
    sv_, tv_, xv_, yv_ = tt(Sv), tt(Tv, torch.long), tt(Xv), tt(Yv)
    best, best_state, patience, history = float("inf"), None, 0, []
    bs = 128
    for ep in range(epochs):
        model.train()
        perm = torch.randperm(len(str_))
        for i in range(0, len(str_), bs):
            idx = perm[i:i + bs]
            opt.zero_grad()
            loss = loss_fn(model(str_[idx], ttr_[idx], xtr_[idx]), ytr_[idx])
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
        model.eval()
        with torch.no_grad():
            vl = float(loss_fn(model(sv_, tv_, xv_), yv_))
        history.append({"epoch": ep + 1, "val_loss": round(vl, 5)})
        if vl < best - 1e-4:
            best, patience = vl, 0
            best_state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        else:
            patience += 1
            if patience >= 20:
                break
    if best_state:
        model.load_state_dict(best_state)
    model.eval()
    return model, {"epochs_run": len(history), "best_val_loss": round(best, 5), "history": history[-20:]}


def proba(model: BehaviorTransformer, S: np.ndarray, T: np.ndarray, X: np.ndarray) -> np.ndarray:
    with torch.no_grad():
        out = model(
            torch.tensor(S, dtype=torch.float32),
            torch.tensor(T, dtype=torch.long),
            torch.tensor(X, dtype=torch.float32),
        )
        return torch.sigmoid(out).numpy()
