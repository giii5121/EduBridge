r"""Cognitive diagnosis models.

Main model: probabilistic DINA fitted by mean-field variational EM (``PDINA``)
==============================================================================

Generative model (DINA, Junker & Sijtsma 2001)::

    alpha_ik ~ Bernoulli(lambda_ik)                         latent mastery of concept k
    eta_ij   = prod_k alpha_ik ^ q_jk                        1 iff all required concepts mastered
    P(X_ij = 1 | alpha_i) = (1 - s_j)^eta_ij * g_j^(1 - eta_ij)

with item guessing g_j, slipping s_j (constraint g_j + s_j < 1) and Beta priors
g_j ~ Beta(a_g, b_g), s_j ~ Beta(a_s, b_s) that regularise items with few responses.

Prior on mastery (selected on validation):
  * ``independent``  : lambda_ik = lambda_k (population base rate, Beta(2,2) hyper-prior)
  * ``higher_order`` : lambda_ik = sigmoid(a_k * theta_i - b_k), theta_i ~ N(0,1)
                       (HO-DINA, de la Torre & Douglas 2004; theta is a MAP point estimate)

Inference without enumerating 2^K profiles
------------------------------------------
Variational family q(alpha_i) = prod_k Bernoulli(pi_ik). Because the likelihood depends on
alpha only through the binary eta_ij and, under q, P_q(eta_ij = 1) = rho_ij = prod_k pi_ik^q_jk,
the ELBO is available in closed form::

    ELBO = sum_ij m_ij w_ij [rho_ij l1_ij + (1 - rho_ij) l0_ij]  -  sum_ik KL(Bern(pi_ik) || Bern(lambda_ik))
    l1_ij = x log(1-s_j) + (1-x) log s_j ,   l0_ij = x log g_j + (1-x) log(1-g_j)

m_ij is the observation mask (unanswered items contribute nothing) and w_ij an optional
class weight. Coordinate ascent gives the update::

    logit pi_ik = logit lambda_ik + sum_j m_ij w_ij q_jk (rho_ij / pi_ik) (l1_ij - l0_ij)

For single-concept items rho_ij / pi_ik = 1, so the update is exact Bayes and the mean-field
posterior is the exact posterior when a student only meets single-concept items (98.5% of
EEDI items). Multi-concept items are handled by damped fixed-point iteration.
M-step (closed form, MAP with Beta priors)::

    s_j = (sum_i m w rho (1-x) + a_s - 1) / (sum_i m w rho + a_s + b_s - 2)
    g_j = (sum_i m w (1-rho) x + a_g - 1) / (sum_i m w (1-rho) + a_g + b_g - 2)

Inference for a NEW student keeps (g, s, prior parameters) fixed and only runs the E-step,
so no global retraining happens. pi_ik is the reported mastery probability; concepts for which
a student has no observed evidence simply return their prior.

Baselines (all Q-matrix bound, all fitted on train only):
  * ``ItemMeanBaseline``      non-personalised item pass rate
  * ``ConceptScoreBaseline``  Beta-smoothed per-student proportion correct per concept
  * ``QLogisticBaseline``     compensatory logistic model, logit p = mean_{k in K_j} theta_ik - b_j
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

EPS = 1e-6


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -35, 35)))


def logit(p):
    p = np.clip(p, EPS, 1 - EPS)
    return np.log(p) - np.log1p(-p)


def bern_kl(p, q):
    p = np.clip(p, EPS, 1 - EPS)
    q = np.clip(q, EPS, 1 - EPS)
    return p * (np.log(p) - np.log(q)) + (1 - p) * (np.log1p(-p) - np.log1p(-q))


def bern_entropy(p):
    p = np.clip(p, EPS, 1 - EPS)
    return -(p * np.log2(p) + (1 - p) * np.log2(1 - p))


@dataclass
class MasteryPosterior:
    pi: np.ndarray            # (N, K) mastery probabilities q(alpha_ik = 1)
    theta: np.ndarray         # (N,) general ability (higher-order prior) or zeros
    n_evidence: np.ndarray    # (N, K) observed responses touching concept k
    n_correct: np.ndarray     # (N, K) correct responses among them
    prior: np.ndarray         # (N, K) prior mastery probability used

    @property
    def entropy(self):
        return bern_entropy(self.pi)

    @property
    def sd(self):
        return np.sqrt(self.pi * (1 - self.pi))


class PDINA:
    name = "pdina"

    def __init__(self, Q, prior="independent", gs_prior_strength=10.0, guess_prior_mean=0.2, slip_prior_mean=0.2,
                 class_weights=None, max_em_iter=150, em_tol=1e-6, e_step_iter=30, max_guess_slip_sum=0.98,
                 ho_a_prior_sd=1.0, ho_b_prior_sd=2.0, verbose=False):
        if prior not in ("independent", "higher_order"):
            raise ValueError("prior must be 'independent' or 'higher_order'")
        self.Q = np.asarray(Q, dtype=float)
        if not set(np.unique(self.Q).tolist()) <= {0.0, 1.0}:
            raise ValueError("Q must be binary")
        self.J, self.K = self.Q.shape
        self.prior = prior
        self.kappa = float(gs_prior_strength)
        self.ag, self.bg = 1 + self.kappa * guess_prior_mean, 1 + self.kappa * (1 - guess_prior_mean)
        self.as_, self.bs = 1 + self.kappa * slip_prior_mean, 1 + self.kappa * (1 - slip_prior_mean)
        self.class_weights = class_weights
        self.max_em_iter, self.em_tol, self.e_step_iter = max_em_iter, em_tol, e_step_iter
        self.max_gs = max_guess_slip_sum
        self.ho_a_sd, self.ho_b_sd = ho_a_prior_sd, ho_b_prior_sd
        self.verbose = verbose
        self.n_concepts_per_item = self.Q.sum(1)
        self.multi = self.n_concepts_per_item > 1
        self.single = ~self.multi
        # parameters
        self.g = np.full(self.J, guess_prior_mean)
        self.s = np.full(self.J, slip_prior_mean)
        self.lam = np.full(self.K, 0.5)
        self.ho_a = np.ones(self.K)
        self.ho_b = np.zeros(self.K)
        self.history: list = []
        self.fitted = False

    # ---------------------------------------------------------------- helpers
    def hyperparams(self) -> dict:
        return {"prior": self.prior, "gs_prior_strength": self.kappa, "class_weights": self.class_weights,
                "max_em_iter": self.max_em_iter, "em_tol": self.em_tol, "e_step_iter": self.e_step_iter,
                "guess_prior": [self.ag, self.bg], "slip_prior": [self.as_, self.bs], "max_guess_slip_sum": self.max_gs}

    def _weights(self, X, M):
        W = M.astype(float)
        if self.class_weights:
            w0, w1 = float(self.class_weights["0"]), float(self.class_weights["1"])
            W = W * (X * w1 + (1 - X) * w0)
        return W

    def _prior_prob(self, theta):
        if self.prior == "independent":
            return np.broadcast_to(self.lam, (len(theta), self.K))
        return sigmoid(theta[:, None] * self.ho_a[None, :] - self.ho_b[None, :])

    def _rho(self, pi):
        return np.exp(np.log(np.clip(pi, EPS, 1)) @ self.Q.T)

    def _prep(self, X, M):
        X = np.where(M, np.asarray(X, float), 0.0)
        W = self._weights(X, M)
        WX = W * X
        return {"W": W, "WX": WX, "W1": W - WX, "Wsum": W.sum(0), "WXsum": WX.sum(0)}

    def _log_odds_terms(self):
        A1 = np.log1p(-self.s) - np.log(self.g)       # log((1-s)/g)  evidence of a correct answer
        A0 = np.log(self.s) - np.log1p(-self.g)       # log(s/(1-g))  evidence of an incorrect answer
        return A1, A0

    def _update_theta(self, theta, pi, n_newton=3):
        for _ in range(n_newton):
            p = sigmoid(theta[:, None] * self.ho_a - self.ho_b)
            grad = ((pi - p) * self.ho_a).sum(1) - theta
            hess = -(p * (1 - p) * self.ho_a ** 2).sum(1) - 1.0
            theta = theta - grad / hess
        return np.clip(theta, -6, 6)

    # ---------------------------------------------------------------- E-step
    def _e_step(self, P, pi=None, theta=None, n_iter=None):
        """Coordinate-ascent E-step.

        Single-concept items give an exact closed-form update, computed with two matrix products.
        The damped fixed-point loop for multi-concept items only runs on the (students x concepts)
        block that actually touches an observed multi-concept item.
        """
        WX, W1, W = P["WX"], P["W1"], P["W"]
        N = W.shape[0]
        n_iter = n_iter or self.e_step_iter
        A1, A0 = self._log_odds_terms()
        Qs = self.Q * self.single[:, None]
        ev_single = WX @ (A1[:, None] * Qs) + W1 @ (A0[:, None] * Qs)
        theta = np.zeros(N) if theta is None else theta.copy()
        midx = np.where(self.multi)[0]
        Qm = self.Q[midx]
        cols = np.where(Qm.any(0))[0]
        rows = np.where((W[:, midx] > 0).any(1))[0] if len(midx) else np.array([], int)
        Qmc = Qm[:, cols]
        Dm = (WX[np.ix_(rows, midx)] * A1[midx] + W1[np.ix_(rows, midx)] * A0[midx]) if len(rows) else None
        outer = n_iter if self.prior == "higher_order" else 1
        for _ in range(outer):
            lp = logit(self._prior_prob(theta))
            new = sigmoid(lp + ev_single)
            if len(rows):
                base = (lp + ev_single)[np.ix_(rows, cols)]
                sub = new[np.ix_(rows, cols)] if pi is None else pi[np.ix_(rows, cols)]
                for _ in range(n_iter):
                    rho_m = np.exp(np.log(np.clip(sub, EPS, 1)) @ Qmc.T)
                    upd = sigmoid(base + ((Dm * rho_m) @ Qmc) / np.clip(sub, EPS, 1))
                    upd = 0.5 * upd + 0.5 * sub  # damping: multi-concept terms are not separable
                    done = np.max(np.abs(upd - sub)) < 1e-6
                    sub = upd
                    if done:
                        break
                new[np.ix_(rows, cols)] = sub
            delta = np.max(np.abs(new - pi)) if (pi is not None and N) else np.inf
            pi = np.clip(new, EPS, 1 - EPS)
            if self.prior == "higher_order":
                theta = self._update_theta(theta, pi)
                if delta < 1e-5:
                    break
        return pi, theta

    def _suff_stats(self, P, pi):
        """R1_j = sum_i w rho_ij and RX_j = sum_i w x rho_ij without forming the N x J rho matrix."""
        Qs = self.Q * self.single[:, None]
        R1 = ((P["W"].T @ pi) * Qs).sum(1)
        RX = ((P["WX"].T @ pi) * Qs).sum(1)
        midx = np.where(self.multi)[0]
        if len(midx):
            rho_m = np.exp(np.log(np.clip(pi, EPS, 1)) @ self.Q[midx].T)
            R1[midx] = (P["W"][:, midx] * rho_m).sum(0)
            RX[midx] = (P["WX"][:, midx] * rho_m).sum(0)
        return R1, RX

    # ---------------------------------------------------------------- M-step
    def _m_step(self, P, pi, theta, stats):
        R1, RX = stats
        R0 = P["Wsum"] - R1
        S_num = R1 - RX                     # sum w rho (1-x)
        G_num = P["WXsum"] - RX             # sum w (1-rho) x
        s = (S_num + self.as_ - 1) / (R1 + self.as_ + self.bs - 2)
        g = (G_num + self.ag - 1) / (R0 + self.ag + self.bg - 2)
        g, s = np.clip(g, 1e-3, 0.7), np.clip(s, 1e-3, 0.7)
        tot = g + s
        over = tot > self.max_gs
        g[over] *= self.max_gs / tot[over]
        s[over] *= self.max_gs / tot[over]
        self.g, self.s = g, s
        N = pi.shape[0]
        if self.prior == "independent":
            self.lam = np.clip((pi.sum(0) + 1.0) / (N + 2.0), 0.01, 0.99)
        else:
            a, b = self.ho_a.copy(), self.ho_b.copy()
            va, vb = self.ho_a_sd ** 2, self.ho_b_sd ** 2
            for _ in range(3):
                p = sigmoid(theta[:, None] * a - b)
                r, w = pi - p, p * (1 - p)
                ga = (r * theta[:, None]).sum(0) - (a - 1) / va
                gb = -r.sum(0) - b / vb
                haa = -(w * theta[:, None] ** 2).sum(0) - 1 / va
                hbb = -w.sum(0) - 1 / vb
                hab = (w * theta[:, None]).sum(0)
                det = haa * hbb - hab ** 2
                da = (hbb * ga - hab * gb) / det
                db = (haa * gb - hab * ga) / det
                a, b = np.clip(a - da, 0.05, 5.0), np.clip(b - db, -8, 8)
            self.ho_a, self.ho_b = a, b

    def elbo(self, P, pi, theta, stats=None):
        R1, RX = self._suff_stats(P, pi) if stats is None else stats
        ll = (RX @ (np.log1p(-self.s) - np.log(self.g)) + (R1 - RX) @ (np.log(self.s) - np.log1p(-self.g))
              + P["WXsum"] @ np.log(self.g) + (P["Wsum"] - P["WXsum"]) @ np.log1p(-self.g))
        kl = bern_kl(pi, self._prior_prob(theta)).sum()
        lp = ((self.ag - 1) * np.log(self.g) + (self.bg - 1) * np.log1p(-self.g)
              + (self.as_ - 1) * np.log(self.s) + (self.bs - 1) * np.log1p(-self.s)).sum()
        if self.prior == "higher_order":
            lp += -0.5 * (theta ** 2).sum()
        return float(ll - kl + lp)

    # ---------------------------------------------------------------- public API
    def fit(self, X, M):
        M = np.asarray(M, bool)
        P = self._prep(X, M)
        pi, theta, prev = None, None, -np.inf
        for it in range(self.max_em_iter):
            # the HO E-step is warm-started across EM steps, so a few inner sweeps per step suffice
            pi, theta = self._e_step(P, pi, theta, n_iter=min(self.e_step_iter, 5) if it else self.e_step_iter)
            self._m_step(P, pi, theta, self._suff_stats(P, pi))
            el = self.elbo(P, pi, theta)
            self.history.append(el)
            if self.verbose and it % 10 == 0:
                print(f"  EM {it:3d} ELBO {el:.2f}")
            if np.isfinite(prev) and abs(el - prev) <= self.em_tol * abs(prev):
                break
            prev = el
        self.n_em_iter = it + 1
        self.train_pi, self.train_theta = pi, theta
        self.fitted = True
        return self

    def infer(self, X, M) -> MasteryPosterior:
        """E-step only: item and prior parameters stay fixed (new students, partial tests)."""
        X, M = np.atleast_2d(np.asarray(X, float)), np.atleast_2d(np.asarray(M, bool))
        X = np.where(M, X, 0.0)
        pi, theta = self._e_step(self._prep(X, M), n_iter=max(self.e_step_iter, 50))
        n_ev = M.astype(float) @ self.Q
        n_c = (X * M) @ self.Q
        return MasteryPosterior(pi, theta, n_ev.astype(int), n_c.astype(int), np.array(self._prior_prob(theta)))

    def predict_proba(self, post: MasteryPosterior) -> np.ndarray:
        rho = self._rho(post.pi)
        return self.g + (1 - self.s - self.g) * rho

    def predict_from_labels(self, labels: np.ndarray) -> np.ndarray:
        """Hard-classification DINA prediction from 0/1 mastery labels (N, K)."""
        eta = self._rho(np.clip(labels.astype(float), EPS, 1.0)) > 0.5
        return np.where(eta, 1 - self.s, self.g)

    @property
    def discrimination(self):
        return 1 - self.s - self.g

    # ---------------------------------------------------------------- persistence
    def save(self, path: str | Path, extra: dict | None = None):
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        np.savez(path / "pdina_params.npz", Q=self.Q, g=self.g, s=self.s, lam=self.lam, ho_a=self.ho_a, ho_b=self.ho_b,
                 question_ids=np.asarray(getattr(self, "question_ids", np.arange(self.J))),
                 concept_ids=np.asarray(getattr(self, "concept_ids", np.arange(self.K))))
        meta = {"class": "PDINA", "hyperparams": self.hyperparams(), "n_em_iter": getattr(self, "n_em_iter", None),
                "final_elbo": self.history[-1] if self.history else None}
        if extra:
            meta.update(extra)
        (path / "pdina_config.json").write_text(json.dumps(meta, indent=2, default=_json_default), encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "PDINA":
        path = Path(path)
        meta = json.loads((path / "pdina_config.json").read_text(encoding="utf-8"))
        hp = meta["hyperparams"]
        with np.load(path / "pdina_params.npz") as z:
            m = cls(z["Q"], prior=hp["prior"], gs_prior_strength=hp["gs_prior_strength"],
                    class_weights=hp["class_weights"], max_em_iter=hp["max_em_iter"], em_tol=hp["em_tol"],
                    e_step_iter=hp["e_step_iter"], max_guess_slip_sum=hp["max_guess_slip_sum"])
            m.ag, m.bg = hp["guess_prior"]
            m.as_, m.bs = hp["slip_prior"]
            m.g, m.s, m.lam, m.ho_a, m.ho_b = z["g"], z["s"], z["lam"], z["ho_a"], z["ho_b"]
            m.question_ids, m.concept_ids = z["question_ids"], z["concept_ids"]
        m.fitted = True
        m.meta = meta
        return m


def _json_default(o):
    if isinstance(o, (np.integer,)):
        return int(o)
    if isinstance(o, (np.floating,)):
        return float(o)
    if isinstance(o, np.ndarray):
        return o.tolist()
    raise TypeError(type(o))


# ======================================================================================
# Baselines
# ======================================================================================

class ItemMeanBaseline:
    name = "item_mean"

    def __init__(self, Q, strength=2.0):
        self.Q = np.asarray(Q, float)
        self.strength = strength

    def fit(self, X, M):
        M = M.astype(bool)
        base = (X * M).sum() / M.sum()
        self.p = ((X * M).sum(0) + self.strength * base) / (M.sum(0) + self.strength)
        return self

    def infer(self, X, M):
        return np.zeros((np.atleast_2d(X).shape[0], 0))

    def predict_proba(self, state):
        return np.broadcast_to(self.p, (state.shape[0], len(self.p))).copy()


class ConceptScoreBaseline:
    """Smoothed proportion correct per (student, concept); prediction = mean over item's concepts."""
    name = "concept_score"

    def __init__(self, Q, strength=5.0):
        self.Q = np.asarray(Q, float)
        self.strength = strength

    def fit(self, X, M):
        M = M.astype(float)
        n, c = M.sum(0) @ self.Q, (X * M).sum(0) @ self.Q
        self.mu = np.where(n > 0, (c + 1) / (n + 2), 0.5)
        return self

    def infer(self, X, M):
        M = np.atleast_2d(M).astype(float)
        X = np.atleast_2d(X)
        n, c = M @ self.Q, (X * M) @ self.Q
        return (c + self.strength * self.mu) / (n + self.strength)

    def predict_proba(self, pi):
        Qn = self.Q / np.maximum(self.Q.sum(1, keepdims=True), 1)
        return np.clip(pi @ Qn.T, EPS, 1 - EPS)


class QLogisticBaseline:
    """Compensatory Q-constrained logistic model: logit p_ij = sum_k qn_jk theta_ik - b_j."""
    name = "q_logistic"

    def __init__(self, Q, sigma=1.0, n_iter=25):
        self.Q = np.asarray(Q, float)
        self.Qn = self.Q / np.maximum(self.Q.sum(1, keepdims=True), 1)
        self.sigma, self.n_iter = sigma, n_iter
        self.b = np.zeros(self.Q.shape[0])

    def _theta_steps(self, X, M, theta, n):
        for _ in range(n):
            p = sigmoid(theta @ self.Qn.T - self.b)
            r = M * (X - p)
            grad = r @ self.Qn - theta / self.sigma ** 2
            hess = -(M * p * (1 - p)) @ (self.Qn ** 2) - 1 / self.sigma ** 2
            theta = np.clip(theta - grad / hess, -8, 8)
        return theta

    def fit(self, X, M):
        M = M.astype(float)
        theta = np.zeros((X.shape[0], self.Q.shape[1]))
        for _ in range(self.n_iter):
            theta = self._theta_steps(X, M, theta, 2)
            p = sigmoid(theta @ self.Qn.T - self.b)
            gb = -(M * (X - p)).sum(0) - self.b / 9.0
            hb = -(M * p * (1 - p)).sum(0) - 1 / 9.0
            self.b = np.clip(self.b - gb / hb, -8, 8)
        return self

    def infer(self, X, M):
        X, M = np.atleast_2d(X), np.atleast_2d(M).astype(float)
        return self._theta_steps(X, M, np.zeros((X.shape[0], self.Q.shape[1])), 25)

    def predict_proba(self, theta):
        return sigmoid(theta @ self.Qn.T - self.b)
