"""
run_experiments.py — VENTANA SECA
Bateria experimental: baselines + DLNM (cross-basis de rezagos) + GLM Poisson/NB.

INLA no esta instalado en este R. Para UNA serie temporal (Guayaquil x semana)
el equivalente defendible es el DLNM clasico de Gasparrini (glm + base de rezagos).
El componente espacial BYM2 no aplica (una sola unidad). La estructura temporal
se modela con armonicos semanales + efecto de anio.

Dos modalidades de Y (nunca mezcladas, nunca simuladas):
  NAT  : casos_dengue_nacional  2021-W01..2023-W52  (OpenDengue/PAHO, A)
  GYA  : casos_dengue Guayas    2026-W01..2026-W33  (Gaceta ETV SE33, B)

Salidas: results/*.csv  results/figures/*.png
"""
import os, warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import statsmodels.api as sm
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, roc_auc_score

warnings.filterwarnings("ignore")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "model", "ventana_seca_guayaquil_weekly.csv")
RES = os.path.join(ROOT, "results")
FIG = os.path.join(RES, "figures")
os.makedirs(FIG, exist_ok=True)


def ns_basis(x, df=3):
    """Base de spline natural via patsy (incluye intercepto de spline, sin constante extra)."""
    from patsy import dmatrix
    x = np.asarray(x, dtype=float)
    return np.asarray(dmatrix(f"cr(x, df={df}) - 1", {"x": x}))


def lag_matrix(x, maxlag):
    x = np.asarray(x, dtype=float)
    n = len(x)
    M = np.full((n, maxlag + 1), np.nan)
    for L in range(maxlag + 1):
        M[L:, L] = x[: n - L]
    return M


def cross_basis_linear(x, maxlag, lag_df=4):
    """DLNM lineal en exposicion, spline en el rezago. Devuelve (n x k) y la base de lags."""
    M = lag_matrix(x, maxlag)
    lags = np.arange(maxlag + 1, dtype=float)
    if maxlag < 3:
        B = np.eye(maxlag + 1)
    else:
        B = ns_basis(lags, df=min(lag_df, maxlag))
    out = np.full((len(x), B.shape[1]), np.nan)
    ok = ~np.isnan(M).any(axis=1)
    out[ok] = M[ok] @ B
    return out, B, lags


def harmonics(week, k=2):
    w = np.asarray(week, dtype=float)
    cols = []
    for i in range(1, k + 1):
        cols.append(np.sin(2 * np.pi * i * w / 52.0))
        cols.append(np.cos(2 * np.pi * i * w / 52.0))
    return np.column_stack(cols)


def design(df, ycol, extras, maxlag=20, lag_df=4, with_harmonics=True, with_year=True):
    y = df[ycol].astype(float).values
    pop = df["poblacion"].astype(float).values
    week = df["semana"].astype(float).values
    parts = [np.ones((len(df), 1))]
    names = ["intercept"]
    if with_harmonics:
        H = harmonics(week, k=2)
        parts.append(H)
        names += [f"h{i}" for i in range(H.shape[1])]
    if with_year and df["anio_epi"].nunique() > 1:
        for yr in sorted(df["anio_epi"].unique())[1:]:
            parts.append((df["anio_epi"].values == yr).astype(float)[:, None])
            names.append(f"yr{yr}")
    for col, use_cb, ml in extras:
        x = df[col].astype(float).fillna(0).values
        if use_cb:
            cb, _, _ = cross_basis_linear(x, ml, lag_df=lag_df)
            parts.append(cb)
            names += [f"cb_{col}_{k}" for k in range(cb.shape[1])]
        else:
            parts.append(x[:, None])
            names.append(col)
    X = np.hstack(parts)
    # filas validas: y no NA y X finito
    ok = np.isfinite(y) & np.isfinite(X).all(axis=1) & (pop > 0)
    return X, y, pop, ok, names


def fit_glm(X, y, pop, family="nb"):
    off = np.log(pop)
    if family == "poisson":
        mod = sm.GLM(y, X, family=sm.families.Poisson(), offset=off)
        res = mod.fit(disp=0)
        return res, "poisson", None
    # NB: estimar alpha desde Poisson
    pois = sm.GLM(y, X, family=sm.families.Poisson(), offset=off).fit(disp=0)
    mu = pois.fittedvalues
    pearson = np.sum((y - mu) ** 2 / np.maximum(mu, 1e-8))
    alpha = max((pearson - pois.df_resid) / np.sum(mu), 1e-6)
    mod = sm.GLM(y, X, family=sm.families.NegativeBinomial(alpha=alpha), offset=off)
    res = mod.fit(disp=0)
    return res, "nb", alpha


def predict_mu(res, X, pop):
    return np.asarray(res.predict(X, offset=np.log(pop)))


def metrics(y, mu, name, n_params=None):
    y, mu = np.asarray(y, float), np.asarray(mu, float)
    mae = float(np.mean(np.abs(y - mu)))
    rmse = float(np.sqrt(np.mean((y - mu) ** 2)))
    # deviance Poisson-like
    ok = (y > 0) & (mu > 0)
    dev = float(2 * np.sum(y[ok] * np.log(y[ok] / mu[ok]) - (y[ok] - mu[ok])))
    # log score Poisson
    from scipy.stats import poisson
    ls = float(np.mean(poisson.logpmf(np.clip(y, 0, None).astype(int), np.clip(mu, 1e-6, None))))
    # alto riesgo: percentil 75 del observado
    thr = np.quantile(y, 0.75)
    yt = (y >= thr).astype(int)
    yp = (mu >= thr).astype(int)
    tp = int(((yt == 1) & (yp == 1)).sum())
    fp = int(((yt == 0) & (yp == 1)).sum())
    fn = int(((yt == 1) & (yp == 0)).sum())
    prec = tp / (tp + fp) if (tp + fp) else np.nan
    rec = tp / (tp + fn) if (tp + fn) else np.nan
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else np.nan
    try:
        auc = float(roc_auc_score(yt, mu)) if yt.min() != yt.max() else np.nan
    except Exception:
        auc = np.nan
    return dict(modelo=name, MAE=mae, RMSE=rmse, Deviance=dev, LogScore=ls,
                precision_alto=prec, recall_alto=rec, F1_alto=f1, AUC_alto=auc,
                N=len(y), n_params=n_params)


def lag_effects(res, names, col, B, lags, q=1.96):
    """Efecto por lag para exposicion lineal: beta_lag = B @ coef_cb"""
    idx = [i for i, n in enumerate(names) if n.startswith(f"cb_{col}_")]
    if not idx:
        return pd.DataFrame()
    b = res.params[idx]
    cov = res.cov_params()
    if hasattr(cov, "values"):
        cov = cov.values
    C = cov[np.ix_(idx, idx)]
    eff = B @ b
    se = np.sqrt(np.clip(np.einsum("ij,jk,ik->i", B, C, B), 0, None))
    return pd.DataFrame({
        "variable": col, "lag": lags, "efecto": eff,
        "lo": eff - q * se, "hi": eff + q * se,
    })


def savefig(path):
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()


def run_modality(df, ycol, tag, train_mask, test_mask, maxlag):
    rows, lag_rows = [], []
    d = df.copy()
    # --- baselines ---
    y_tr = d.loc[train_mask, ycol].astype(float).values
    y_te = d.loc[test_mask, ycol].astype(float).values
    mu_mean = np.full_like(y_te, np.nanmean(y_tr), dtype=float)
    rows.append(metrics(y_te, mu_mean, f"{tag}|baseline_media", 1))
    # naive: ultimo valor train
    mu_naive = np.full_like(y_te, y_tr[-1], dtype=float)
    rows.append(metrics(y_te, mu_naive, f"{tag}|baseline_naive", 1))

    specs = [
        ("E1_corte_hn", [( "corte_hn", False, 0)], False),
        ("E2_horas", [( "horas_corte", False, 0)], False),
        ("E3_corte_clima", [( "corte_hn", False, 0), ("precipitacion_mm", False, 0), ("tmin", False, 0)], True),
        ("E4_dlnm_corte", [( "corte_hn", True, maxlag)], True),
        ("E5_dlnm_clima", [( "precipitacion_mm", True, maxlag), ("tmin", True, min(8, maxlag))], True),
        ("E6_completo", [( "corte_hn", True, maxlag), ("precipitacion_mm", True, maxlag),
                         ("tmin", True, min(8, maxlag)), ("spi6", False, 0)], True),
        ("B4_clima_time", [( "precipitacion_mm", False, 0), ("tmin", False, 0), ("spi6", False, 0)], True),
        ("B5_cortes_time", [( "corte_hn", False, 0), ("horas_corte", False, 0)], True),
        ("HYP_clima", [( "precipitacion_mm", True, maxlag), ("tmin", True, min(8, maxlag))], True),
        ("HYP_clima_cortes", [( "precipitacion_mm", True, maxlag), ("tmin", True, min(8, maxlag)),
                              ("corte_hn", True, maxlag)], True),
    ]

    fitted = {}
    for name, extras, harms in specs:
        try:
            X, y, pop, ok, names = design(d, ycol, extras, maxlag=maxlag, with_harmonics=harms)
            tr = ok & train_mask.values
            te = ok & test_mask.values
            npar_guess = X.shape[1]
            if tr.sum() < 12 or te.sum() < 4 or npar_guess > max(8, tr.sum() // 3):
                rows.append(dict(modelo=f"{tag}|{name}", MAE=np.nan, RMSE=np.nan,
                                 Deviance=np.nan, LogScore=np.nan, precision_alto=np.nan,
                                 recall_alto=np.nan, F1_alto=np.nan, AUC_alto=np.nan,
                                 N=int(te.sum()), n_params=None, observaciones="N insuficiente"))
                continue
            # overdispersion check
            res_p, _, _ = fit_glm(X[tr], y[tr], pop[tr], "poisson")
            mu_p = predict_mu(res_p, X[tr], pop[tr])
            disp = float(np.sum((y[tr] - mu_p) ** 2 / np.maximum(mu_p, 1e-8)) / max(res_p.df_resid, 1))
            fam = "nb" if disp > 1.5 else "poisson"
            res, fam_used, alpha = fit_glm(X[tr], y[tr], pop[tr], fam)
            mu = predict_mu(res, X[te], pop[te])
            m = metrics(y[te], mu, f"{tag}|{name}", n_params=int(res.df_model) + 1)
            m["familia"] = fam_used
            m["overdisp_train"] = disp
            m["alpha_nb"] = alpha
            m["N_train"] = int(tr.sum())
            rows.append(m)
            fitted[name] = (res, names, X, y, pop, ok, extras)
            if name == "E4_dlnm_corte":
                cb, B, lags = cross_basis_linear(d["corte_hn"].astype(float).fillna(0).values, maxlag)
                le = lag_effects(res, names, "corte_hn", B, lags)
                if len(le):
                    le["modalidad"] = tag
                    lag_rows.append(le)
        except Exception as e:
            rows.append(dict(modelo=f"{tag}|{name}", MAE=np.nan, RMSE=np.nan,
                             Deviance=np.nan, LogScore=np.nan, observaciones=str(e)[:180]))

    # RF baseline
    try:
        feats = ["corte_hn", "horas_corte", "precipitacion_mm", "tmin", "spi6", "semana"]
        Xrf = d[feats].fillna(0).values
        yrf = d[ycol].astype(float).values
        tr = train_mask.values & np.isfinite(yrf)
        te = test_mask.values & np.isfinite(yrf)
        rf = RandomForestRegressor(n_estimators=200, random_state=42, max_depth=6)
        rf.fit(Xrf[tr], yrf[tr])
        mu = rf.predict(Xrf[te])
        rows.append(metrics(yrf[te], mu, f"{tag}|B6_random_forest", 200))
    except Exception as e:
        rows.append(dict(modelo=f"{tag}|B6_random_forest", observaciones=str(e)[:120]))

    return pd.DataFrame(rows), (pd.concat(lag_rows) if lag_rows else pd.DataFrame()), fitted


def plots(df):
    # 1 dengue nacional
    plt.figure(figsize=(10, 3.2))
    m = df["casos_dengue_nacional"].notna()
    plt.plot(df.loc[m, "fecha_lunes"], df.loc[m, "casos_dengue_nacional"], color="#1d4ed8", lw=1.2)
    plt.title("Dengue nacional semanal (OpenDengue/PAHO)")
    plt.ylabel("casos")
    savefig(os.path.join(FIG, "01_dengue_nacional.png"))

    # 2 dengue Guayas 2026
    plt.figure(figsize=(10, 3.2))
    m = df["casos_dengue"].notna()
    plt.plot(df.loc[m, "fecha_lunes"], df.loc[m, "casos_dengue"], color="#b45309", marker="o", ms=3)
    plt.title("Dengue Guayas semanal 2026 (Gaceta ETV SE33)")
    plt.ylabel("casos")
    savefig(os.path.join(FIG, "02_dengue_guayas_2026.png"))

    # 3 cortes
    plt.figure(figsize=(10, 3.2))
    plt.bar(df["fecha_lunes"], df["horas_corte"], color="#0f766e", width=6)
    plt.title("Horas de corte de agua reportadas (Guayaquil)")
    plt.ylabel("horas")
    savefig(os.path.join(FIG, "03_cortes_horas.png"))

    # 4b overlay Guayas 2026 + cortes
    fig, ax1 = plt.subplots(figsize=(10, 3.4))
    m = df["casos_dengue"].notna()
    ax1.plot(df.loc[m, "fecha_lunes"], df.loc[m, "casos_dengue"], color="#b45309", marker="o", ms=3)
    ax1.set_ylabel("casos Guayas", color="#b45309")
    ax2 = ax1.twinx()
    ax2.bar(df.loc[m, "fecha_lunes"], df.loc[m, "horas_corte"], color="#0f766e", alpha=0.4, width=5)
    ax2.set_ylabel("horas_corte", color="#0f766e")
    ax1.set_title("Guayas 2026: dengue vs horas de corte (misma semana)")
    savefig(os.path.join(FIG, "04b_guayas_dengue_vs_cortes.png"))

    # 4 overlay nacional + cortes
    fig, ax1 = plt.subplots(figsize=(10, 3.4))
    m = df["casos_dengue_nacional"].notna()
    ax1.plot(df.loc[m, "fecha_lunes"], df.loc[m, "casos_dengue_nacional"], color="#1d4ed8")
    ax1.set_ylabel("casos nacionales", color="#1d4ed8")
    ax2 = ax1.twinx()
    ax2.bar(df["fecha_lunes"], df["corte_hn"] * df.loc[m, "casos_dengue_nacional"].max() * 0.15,
            color="#f59e0b", alpha=0.45, width=6)
    ax2.set_ylabel("corte_hn (marca)", color="#f59e0b")
    ax1.set_title("Dengue nacional vs semanas con corte en Guayaquil")
    savefig(os.path.join(FIG, "04_dengue_vs_cortes.png"))


def main():
    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    plots(df)

    # cobertura
    cov = []
    for c in df.columns:
        n = int(df[c].notna().sum())
        cov.append(dict(variable=c, disponible=n, NA=int(len(df) - n),
                        cobertura_pct=round(100 * n / len(df), 1)))
    pd.DataFrame(cov).to_csv(os.path.join(RES, "cobertura.csv"), index=False)

    # NAT: 2021-2022 train, 2023 test
    nat_ok = df["casos_dengue_nacional"].notna()
    train_nat = nat_ok & (df["anio_epi"] <= 2022)
    test_nat = nat_ok & (df["anio_epi"] == 2023)
    m_nat, lag_nat, fit_nat = run_modality(df, "casos_dengue_nacional", "NAT",
                                           train_nat, test_nat, maxlag=20)

    # GYA: primeras 27 semanas train, ultimas 6 test (walk-forward corto)
    gya_ok = df["casos_dengue"].notna()
    gya_idx = np.where(gya_ok.values)[0]
    train_g = pd.Series(False, index=df.index)
    test_g = pd.Series(False, index=df.index)
    if len(gya_idx) >= 12:
        train_g.iloc[gya_idx[:-6]] = True
        test_g.iloc[gya_idx[-6:]] = True
    m_gya, lag_gya, fit_gya = run_modality(df, "casos_dengue", "GYA",
                                           train_g, test_g, maxlag=2)

    metrics_df = pd.concat([m_nat, m_gya], ignore_index=True)
    metrics_df.to_csv(os.path.join(RES, "metrics.csv"), index=False)
    metrics_df.to_csv(os.path.join(RES, "model_comparison.csv"), index=False)

    lags = pd.concat([x for x in [lag_nat, lag_gya] if len(x)], ignore_index=True) if True else pd.DataFrame()
    if len(lag_nat) or len(lag_gya):
        lags = pd.concat([lag_nat, lag_gya], ignore_index=True)
        lags.to_csv(os.path.join(RES, "lag_effects.csv"), index=False)
        for mod, sub in lags.groupby("modalidad"):
            plt.figure(figsize=(8, 3.2))
            plt.axhline(0, color="#999", lw=0.8)
            plt.plot(sub["lag"], sub["efecto"], color="#0f766e")
            plt.fill_between(sub["lag"], sub["lo"], sub["hi"], color="#0f766e", alpha=0.2)
            plt.xlabel("lag (semanas)")
            plt.ylabel("efecto log-riesgo (corte_hn)")
            plt.title(f"Efecto por lag — {mod}")
            savefig(os.path.join(FIG, f"05_lag_{mod}.png"))
    else:
        pd.DataFrame().to_csv(os.path.join(RES, "lag_effects.csv"), index=False)

    # prediccion vs observado NAT HYP
    if "HYP_clima_cortes" in fit_nat:
        res, names, X, y, pop, ok, _ = fit_nat["HYP_clima_cortes"]
        te = ok & test_nat.values
        mu = predict_mu(res, X[te], pop[te])
        plt.figure(figsize=(9, 3.2))
        t = df.loc[te, "fecha_lunes"]
        plt.plot(t, y[te], label="observado", color="#1d4ed8")
        plt.plot(t, mu, label="predicho DLNM clima+cortes", color="#b45309")
        plt.legend()
        plt.title("NAT 2023: observado vs predicho")
        savefig(os.path.join(FIG, "06_pred_vs_obs_NAT.png"))

    # comparacion barras MAE NAT
    sub = metrics_df[metrics_df["modelo"].astype(str).str.startswith("NAT")].dropna(subset=["MAE"])
    if len(sub):
        plt.figure(figsize=(9, 4))
        plt.barh(sub["modelo"], sub["MAE"], color="#334155")
        plt.xlabel("MAE (test 2023)")
        plt.title("Comparacion MAE — modalidad nacional")
        savefig(os.path.join(FIG, "07_mae_comparacion_NAT.png"))

    # walk-forward NAT: origen expandible, horizonte 8 semanas
    wf_rows = []
    nat_idx = np.where(nat_ok.values)[0]
    for origin in range(80, len(nat_idx) - 8, 8):
        tr_i = nat_idx[:origin]
        te_i = nat_idx[origin:origin + 8]
        trm = pd.Series(False, index=df.index); trm.iloc[tr_i] = True
        tem = pd.Series(False, index=df.index); tem.iloc[te_i] = True
        ytr = df.loc[trm, "casos_dengue_nacional"].astype(float).values
        yte = df.loc[tem, "casos_dengue_nacional"].astype(float).values
        wf_rows.append(metrics(yte, np.full_like(yte, np.mean(ytr)), "WF|media"))
        try:
            X, y, pop, ok, _ = design(df, "casos_dengue_nacional",
                                      [("horas_corte", False, 0)], maxlag=0, with_harmonics=False)
            res, _, _ = fit_glm(X[ok & trm.values], y[ok & trm.values], pop[ok & trm.values], "nb")
            mu = predict_mu(res, X[ok & tem.values], pop[ok & tem.values])
            wf_rows.append(metrics(y[ok & tem.values], mu, "WF|horas_corte"))
        except Exception:
            pass
        try:
            X, y, pop, ok, _ = design(df, "casos_dengue_nacional",
                                      [("precipitacion_mm", False, 0), ("tmin", False, 0)],
                                      maxlag=0, with_harmonics=True)
            res, _, _ = fit_glm(X[ok & trm.values], y[ok & trm.values], pop[ok & trm.values], "nb")
            mu = predict_mu(res, X[ok & tem.values], pop[ok & tem.values])
            wf_rows.append(metrics(y[ok & tem.values], mu, "WF|clima_time"))
        except Exception:
            pass
    if wf_rows:
        wf = pd.DataFrame(wf_rows)
        wf.groupby("modelo")[["MAE", "RMSE"]].mean().to_csv(os.path.join(RES, "walkforward.csv"))
        print("\nWalk-forward MAE medio:\n", wf.groupby("modelo")["MAE"].mean())

    # sensibilidad maxlag E4
    sens = []
    for L in (8, 12, 20):
        try:
            X, y, pop, ok, names = design(df, "casos_dengue_nacional",
                                          [("corte_hn", True, L)], maxlag=L)
            tr = ok & train_nat.values
            te = ok & test_nat.values
            res, fam, _ = fit_glm(X[tr], y[tr], pop[tr], "nb")
            mu = predict_mu(res, X[te], pop[te])
            mm = metrics(y[te], mu, f"SENS|dlnm_corte_L{L}")
            mm["maxlag"] = L
            mm["familia"] = fam
            sens.append(mm)
        except Exception as e:
            sens.append(dict(modelo=f"SENS|dlnm_corte_L{L}", observaciones=str(e)[:120]))
    pd.DataFrame(sens).to_csv(os.path.join(RES, "sensitivity.csv"), index=False)

    print(metrics_df[["modelo", "MAE", "RMSE", "LogScore", "N"]].to_string(index=False))
    print("\nFiguras en", FIG)


if __name__ == "__main__":
    main()
