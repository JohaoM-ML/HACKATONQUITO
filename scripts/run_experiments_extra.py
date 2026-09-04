"""
run_experiments_extra.py — VENTANA SECA (extension)
No modifica run_experiments.py ni sus salidas. Reusa design/fit_glm/metrics de ahi.

Agrega 3 cosas sugeridas por la revision de literatura (ver chat/README):
  AR   : casos_dengue_nacional(t-1)/(t-2) como predictor autoregresivo, solo y
         combinado con clima+cortes. Ningun modelo de run_experiments.py usaba
         el valor de la semana anterior como covariable.
  XGB  : XGBoost (objective count:poisson) sobre NAT (156 semanas), con
         importancia de variables. Referencia: Tian et al. 2024 (Singapur),
         XGBoost supero a GLM/RF con datos climaticos semanales.
  HYB  : clasificador binario alto/bajo riesgo para GYA (N=33) via
         Leave-One-Out (la serie es demasiado corta para un split fijo).
         Referencia: Francisco, Carvajal & Watanabe 2024 (PLOS NTD) — con
         series cortas/zero-inflated, clasificar antes de regresionar mejora
         la precision frente a forzar un conteo directo.

Salidas: results/metrics_extra.csv, results/xgb_importance_NAT.csv,
         results/figures/08_xgb_importance_NAT.png,
         results/figures/09_gya_hybrid_confusion.png
"""
import os
import sys
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import accuracy_score, roc_auc_score, confusion_matrix
import xgboost as xgb

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import DATA, RES, FIG, design, fit_glm, predict_mu, metrics, savefig


def add_autoregressive(df):
    df = df.sort_values("fecha_lunes").reset_index(drop=True)
    df["ar1_nac"] = df["casos_dengue_nacional"].shift(1)
    df["ar2_nac"] = df["casos_dengue_nacional"].shift(2)
    return df


def run_ar_models(df, train_mask, test_mask):
    rows = []
    specs = [
        ("AR1", ["ar1_nac"], [("ar1_nac", False, 0)], False),
        ("AR1_harm", ["ar1_nac"], [("ar1_nac", False, 0)], True),
        ("AR1_clima", ["ar1_nac"],
         [("ar1_nac", False, 0), ("precipitacion_mm", False, 0), ("tmin", False, 0)], True),
        ("AR2_clima", ["ar1_nac", "ar2_nac"],
         [("ar1_nac", False, 0), ("ar2_nac", False, 0),
          ("precipitacion_mm", False, 0), ("tmin", False, 0)], True),
        ("AR1_clima_cortes", ["ar1_nac"],
         [("ar1_nac", False, 0), ("precipitacion_mm", False, 0),
          ("tmin", False, 0), ("horas_corte", False, 0)], True),
    ]
    for name, ar_cols, extras, harms in specs:
        try:
            m_tr = train_mask.copy()
            m_te = test_mask.copy()
            for c in ar_cols:
                m_tr = m_tr & df[c].notna()
                m_te = m_te & df[c].notna()
            X, y, pop, ok, names = design(df, "casos_dengue_nacional", extras,
                                          maxlag=0, with_harmonics=harms)
            tr = ok & m_tr.values
            te = ok & m_te.values
            if tr.sum() < 12 or te.sum() < 4:
                rows.append(dict(modelo=f"NAT|{name}", N=int(te.sum()),
                                 observaciones="N insuficiente"))
                continue
            res_p, _, _ = fit_glm(X[tr], y[tr], pop[tr], "poisson")
            mu_p = predict_mu(res_p, X[tr], pop[tr])
            disp = float(np.sum((y[tr] - mu_p) ** 2 / np.maximum(mu_p, 1e-8)) / max(res_p.df_resid, 1))
            fam = "nb" if disp > 1.5 else "poisson"
            res, fam_used, alpha = fit_glm(X[tr], y[tr], pop[tr], fam)
            mu = predict_mu(res, X[te], pop[te])
            m = metrics(y[te], mu, f"NAT|{name}", n_params=int(res.df_model) + 1)
            m["familia"] = fam_used
            m["overdisp_train"] = disp
            rows.append(m)
        except Exception as e:
            rows.append(dict(modelo=f"NAT|{name}", observaciones=str(e)[:180]))
    return pd.DataFrame(rows)


def run_xgb_nat(df, train_mask, test_mask):
    feats = ["ar1_nac", "ar2_nac", "horas_corte", "corte_hn", "precipitacion_mm",
              "precip_30d", "tmin", "tmax", "humedad", "spi6", "semana"]
    d = df.copy()
    for f in feats:
        d[f] = d[f].astype(float)
    y = d["casos_dengue_nacional"].astype(float)
    ok = y.notna() & d[feats].notna().all(axis=1)
    tr = ok & train_mask.values
    te = ok & test_mask.values
    if tr.sum() < 12 or te.sum() < 4:
        return pd.DataFrame([dict(modelo="NAT|XGB_completo", observaciones="N insuficiente")]), None
    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
        objective="count:poisson", random_state=42,
    )
    model.fit(d.loc[tr, feats], y[tr])
    mu = model.predict(d.loc[te, feats])
    m = metrics(y[te].values, mu, "NAT|XGB_completo", n_params=len(feats))
    m["N_train"] = int(tr.sum())
    imp = pd.Series(model.feature_importances_, index=feats).sort_values(ascending=False)
    plt.figure(figsize=(7, 4))
    imp.plot(kind="barh", color="#334155")
    plt.gca().invert_yaxis()
    plt.xlabel("importancia (gain relativo)")
    plt.title("XGBoost — importancia de variables (NAT, test 2023)")
    savefig(os.path.join(FIG, "08_xgb_importance_NAT.png"))
    imp.to_frame("importancia").to_csv(os.path.join(RES, "xgb_importance_NAT.csv"))
    return pd.DataFrame([m]), imp


def run_hybrid_gya(df):
    d = df[df["casos_dengue"].notna()].copy().reset_index(drop=True)
    thr = d["casos_dengue"].median()
    d["alto"] = (d["casos_dengue"] >= thr).astype(int)
    feats = ["horas_corte", "corte_hn", "precipitacion_mm", "tmin", "spi6", "almacenar"]
    X = d[feats].fillna(0).values
    yb = d["alto"].values
    if len(d) < 15 or yb.min() == yb.max():
        return pd.DataFrame([dict(modelo="GYA|HYB_stage1_logreg",
                                  observaciones="N insuficiente o sin variacion de clase")])
    loo = LeaveOneOut()
    preds, probs = [], []
    for tr_i, te_i in loo.split(X):
        clf = LogisticRegression(max_iter=1000)
        clf.fit(X[tr_i], yb[tr_i])
        preds.append(clf.predict(X[te_i])[0])
        probs.append(clf.predict_proba(X[te_i])[0, 1])
    preds, probs = np.array(preds), np.array(probs)
    acc = accuracy_score(yb, preds)
    try:
        auc = roc_auc_score(yb, probs)
    except Exception:
        auc = np.nan
    cm = confusion_matrix(yb, preds)
    plt.figure(figsize=(3.6, 3.4))
    plt.imshow(cm, cmap="Blues")
    for (i, j), v in np.ndenumerate(cm):
        plt.text(j, i, str(v), ha="center", va="center")
    plt.xticks([0, 1], ["bajo", "alto"])
    plt.yticks([0, 1], ["bajo", "alto"])
    plt.xlabel("predicho")
    plt.ylabel("observado")
    plt.title(f"GYA hibrido etapa1 (LOO-CV)\nacc={acc:.2f} auc={auc:.2f}")
    savefig(os.path.join(FIG, "09_gya_hybrid_confusion.png"))
    return pd.DataFrame([dict(modelo="GYA|HYB_stage1_logreg", N=len(d), umbral_alto_casos=thr,
                              accuracy=acc, AUC=auc, metodo="LeaveOneOut")])


def fit_ar1_residuals(df, train_mask):
    """Ajusta el AR1 (inercia+estacionalidad) en train y devuelve el residuo
    (observado - predicho) para TODAS las filas donde se puede calcular."""
    m_tr = train_mask & df["ar1_nac"].notna()
    X, y, pop, ok, names = design(df, "casos_dengue_nacional", [("ar1_nac", False, 0)],
                                  maxlag=0, with_harmonics=False)
    tr = ok & m_tr.values
    res_p, _, _ = fit_glm(X[tr], y[tr], pop[tr], "poisson")
    mu_p = predict_mu(res_p, X[tr], pop[tr])
    disp = float(np.sum((y[tr] - mu_p) ** 2 / np.maximum(mu_p, 1e-8)) / max(res_p.df_resid, 1))
    fam = "nb" if disp > 1.5 else "poisson"
    res, _, _ = fit_glm(X[tr], y[tr], pop[tr], fam)
    mu_all = np.full(len(df), np.nan)
    mu_all[ok] = predict_mu(res, X[ok], pop[ok])
    d = df.copy()
    d["resid_ar1"] = d["casos_dengue_nacional"] - mu_all
    return d


def run_residual_test(d, test_mask, varname, lags=(0, 4, 8, 12, 16, 20)):
    """Prueba si `varname` a distintos rezagos explica lo que el AR1 (pura
    inercia+estacionalidad) NO explica. Es la prueba correcta de 'esta variable
    aporta algo mas alla de la inercia epidemica', no un GLM con todo mezclado."""
    from scipy.stats import pearsonr
    sub = d[test_mask.values & d["resid_ar1"].notna()].copy()
    rows = []
    for L in lags:
        x = sub[varname].shift(L)
        y_ = sub["resid_ar1"]
        pair = pd.concat([x, y_], axis=1).dropna()
        if len(pair) < 8 or pair.iloc[:, 0].nunique() < 2:
            rows.append(dict(variable=varname, lag=L, n=len(pair), r=np.nan, p=np.nan))
            continue
        r, p = pearsonr(pair.iloc[:, 0], pair.iloc[:, 1])
        rows.append(dict(variable=varname, lag=L, n=len(pair), r=r, p=p))
    out = pd.DataFrame(rows)

    plt.figure(figsize=(7, 3.2))
    plt.axhline(0, color="#999", lw=0.8)
    plt.plot(out["lag"], out["r"], marker="o", color="#b45309")
    plt.xlabel(f"lag {varname} (semanas)")
    plt.ylabel("correlacion con residuo AR1 (test 2023)")
    plt.title(f"¿{varname} explica lo que el AR1 NO explica?")
    savefig(os.path.join(FIG, f"10_residual_vs_{varname}.png"))
    return out


def main():
    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    df = add_autoregressive(df)

    nat_ok = df["casos_dengue_nacional"].notna()
    train_nat = nat_ok & (df["anio_epi"] <= 2022)
    test_nat = nat_ok & (df["anio_epi"] == 2023)

    ar_res = run_ar_models(df, train_nat, test_nat)
    xgb_res, imp = run_xgb_nat(df, train_nat, test_nat)
    hyb_res = run_hybrid_gya(df)

    d_resid = fit_ar1_residuals(df, train_nat)
    resid_tables = [run_residual_test(d_resid, test_nat, v)
                    for v in ("horas_corte", "almacenar", "intensidad_corte")]
    resid_res = pd.concat(resid_tables, ignore_index=True)
    resid_res.to_csv(os.path.join(RES, "residual_test_cortes.csv"), index=False)

    out = pd.concat([ar_res, xgb_res, hyb_res], ignore_index=True)
    out.to_csv(os.path.join(RES, "metrics_extra.csv"), index=False)

    print(out.to_string(index=False))
    if imp is not None:
        print("\nXGBoost importancia de variables (NAT):")
        print(imp.to_string())
    print("\nCorrelacion residuo(AR1) vs variables de corte, por lag (test 2023):")
    print(resid_res.to_string(index=False))


if __name__ == "__main__":
    main()
