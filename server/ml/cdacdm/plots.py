"""Static matplotlib figures written by the training pipeline (palette: dataviz reference instance)."""
from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

SERIES = ["#2a78d6", "#eb6834", "#1baf7a"]
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#898781", "#e1e0d9", "#fcfcfb"
STATUS = {"mastered": "#0ca30c", "uncertain": "#fab219", "not_mastered": "#d03b3b", "insufficient_evidence": "#c3c2b7"}


def _style(ax, title):
    ax.set_facecolor(SURFACE)
    ax.set_title(title, loc="left", color=INK, fontsize=11)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    for s in ["left", "bottom"]:
        ax.spines[s].set_color("#c3c2b7")
    ax.tick_params(colors=INK2, labelsize=8)
    ax.grid(color=GRID, linewidth=0.6)
    ax.set_axisbelow(True)


def calibration_plot(tables: dict, path: Path):
    fig, ax = plt.subplots(figsize=(5.2, 4.6), facecolor=SURFACE)
    ax.plot([0, 1], [0, 1], color=MUTED, linewidth=1, linestyle="--", label="perfect calibration")
    for (name, t), c in zip(list(tables.items())[:3], SERIES):
        t = t[t["n"] > 0]
        ax.plot(t["mean_predicted"], t["observed_rate"], color=c, linewidth=2, marker="o", markersize=5, label=name)
    ax.set_xlabel("mean predicted P(correct)", color=INK2)
    ax.set_ylabel("observed correct rate", color=INK2)
    _style(ax, "Reliability diagram (test held-out responses)")
    ax.legend(frameon=False, fontsize=8, labelcolor=INK2)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def bar_h(df: pd.DataFrame, value: str, label: str, title: str, path: Path, xlim=None, ref=None):
    df = df.sort_values(value)
    fig, ax = plt.subplots(figsize=(6.4, max(2.4, 0.32 * len(df) + 1)), facecolor=SURFACE)
    ax.barh(df[label].astype(str), df[value], color=SERIES[0], height=0.6)
    for y, v in enumerate(df[value]):
        if not np.isnan(v):
            ax.text(v, y, f" {v:.3f}", va="center", fontsize=7, color=INK2)
    if ref is not None:
        ax.axvline(ref, color=MUTED, linewidth=1, linestyle="--")
    if xlim:
        ax.set_xlim(*xlim)
    _style(ax, title)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def line_plot(df: pd.DataFrame, x: str, ys: list, title: str, path: Path, xlabel="", ylabel="", vline=None):
    fig, ax = plt.subplots(figsize=(5.6, 3.8), facecolor=SURFACE)
    for y, c in zip(ys[:3], SERIES):
        ax.plot(df[x], df[y], color=c, linewidth=2, marker="o", markersize=5, label=y)
    if vline is not None:
        ax.axvline(vline, color=MUTED, linewidth=1, linestyle="--")
    ax.set_xlabel(xlabel, color=INK2)
    ax.set_ylabel(ylabel, color=INK2)
    _style(ax, title)
    if len(ys) > 1:
        ax.legend(frameon=False, fontsize=8, labelcolor=INK2)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def grouped_lines(df: pd.DataFrame, x: str, y: str, group: str, title: str, path: Path, xlabel="", ylabel=""):
    fig, ax = plt.subplots(figsize=(5.6, 3.8), facecolor=SURFACE)
    for (g, d), c in zip(df.groupby(group), SERIES):
        d = d.groupby(x)[y].mean().reset_index()
        ax.plot(d[x], d[y], color=c, linewidth=2, marker="o", markersize=5, label=str(g))
    ax.set_xlabel(xlabel, color=INK2)
    ax.set_ylabel(ylabel, color=INK2)
    _style(ax, title)
    ax.legend(frameon=False, fontsize=8, labelcolor=INK2)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def stacked_labels(cs: pd.DataFrame, path: Path):
    """Share of students per mastery label, per target concept."""
    order = ["mastered", "uncertain", "not_mastered", "insufficient_evidence"]
    cols = {"mastered": "n_mastered", "uncertain": "n_uncertain", "not_mastered": "n_not_mastered", "insufficient_evidence": "n_insufficient"}
    d = cs.copy()
    tot = d[[cols[o] for o in order]].sum(axis=1)
    fig, ax = plt.subplots(figsize=(7.2, 0.38 * len(d) + 1.4), facecolor=SURFACE)
    left = np.zeros(len(d))
    for o in order:
        w = d[cols[o]] / tot
        ax.barh(d["concept_name"], w, left=left, color=STATUS[o], height=0.6, label=o.replace("_", " "),
                edgecolor=SURFACE, linewidth=1)
        left += w
    ax.set_xlim(0, 1)
    ax.set_xlabel("share of test students", color=INK2)
    _style(ax, "Mastery labels per target concept (EEDI test split, model-based)")
    ax.legend(frameon=False, fontsize=7, ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.12), labelcolor=INK2)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)
