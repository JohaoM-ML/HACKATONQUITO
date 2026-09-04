"""
test_zonas.py — VENTANA SECA (exploratorio, NO parte del pipeline)

NO existe dengue por barrio, parroquia ni canton de Guayaquil en publico.
OpenDengue Spatial_extract_V1_3 (Ecuador): adm_2 vacio. S_res = Admin1 (provincia).
Tampoco hay LIRAa / indice de casa por sector.

Este script modela las DOS cosas que SI se pueden armar sin convenio MSP:

  A. Panel provincial (la 'zona' publica mas fina): dengue semanal por provincia
     costera 2018-2019. Pregunta: ¿se puede predecir por zona geografica?
  B. Zona del CORTE (norte/sur/centro del comunicado) como feature, Y = dengue
     NACIONAL 2023. Pregunta: ¿importa DONDE cortaron, o solo SI cortaron?
     (No es dengue-por-zona. Es exposicion-por-zona. Se declara.)

Criterio: si no gana al naive / al modelo sin zona, no se integra.
"""
import io
import os
import sys
import warnings
import zipfile
import urllib.request

import matplotlib
import numpy as np
import pandas as pd
import statsmodels.api as sm
import xgboost as xgb

matplotlib.use("Agg")
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import DATA, RES, FIG, metrics, savefig
from run_experiments_extra import add_autoregressive, fit_ar1_residuals, run_residual_test

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://github.com/OpenDengue/master-repo/raw/main/data/releases/V1.3/Spatial_extract_V1_3.zip"
PANEL = os.path.join(ROOT, "data", "raw", "dengue_provincias_opendengue_semanal.csv")

# Costera + cuenca: las unicas con media semanal que no es ruido puro (~0-3 casos)
PROVS = ["GUAYAS", "MANABI", "LOS RIOS", "EL ORO", "ESMERALDAS"]


def fetch_provincias():
    if os.path.exists(PANEL):
        return pd.read_csv(PANEL, parse_dates=["calendar_start_date"])
    data = urllib.request.urlopen(URL, timeout=180).read()
    z = zipfile.ZipFile(io.BytesIO(data))
    df = pd.read_csv(z.open(z.namelist()[0]), low_memory=False)
    ecu = df[
        df["adm_0_name"].str.contains("Ecuador", case=False, na=False)
        & (df["T_res"] == "Week")
        & (df["S_res"] == "Admin1")
    ].copy()
    ecu["calendar_start_date"] = pd.to_datetime(ecu["calendar_start_date"])
    iso = ecu["calendar_start_date"].dt.isocalendar()
    ecu["anio_epi"] = iso["year"].values
    ecu["semana"] = iso["week"].values
    ecu["semana_id"] = ecu["anio_epi"].astype(str) + "-W" + ecu["semana"].astype(str).str.zfill(2)
    out = ecu.rename(columns={"adm_1_name": "provincia", "dengue_total": "casos"})[
        ["provincia", "semana_id", "anio_epi", "semana", "calendar_start_date", "casos"]
    ]
    out.to_csv(PANEL, index=False)
    return out


def fit_glm_nb(X, y):
    pois = sm.GLM(y, X, family=sm.families.Poisson()).fit(disp=0)
    mu = pois.fittedvalues
    pearson = np.sum((y - mu) ** 2 / np.maximum(mu, 1e-8))
    if pearson / max(pois.df_resid, 1) <= 1.5:
        return pois
    alpha = max((pearson - pois.df_resid) / np.sum(mu), 1e-6)
    return sm.GLM(y, X, family=sm.families.NegativeBinomial(alpha=alpha)).fit(disp=0)


def parte_a():
    raw = fetch_provincias()
    d = raw[raw["provincia"].isin(PROVS)].copy()
    d = d.sort_values(["provincia", "calendar_start_date"])
    d["gap"] = d.groupby("provincia")["calendar_start_date"].diff().dt.days
    d["ar1"] = d.groupby("provincia")["casos"].shift(1)
    d.loc[d["gap"] != 7, "ar1"] = np.nan

    train = (d["anio_epi"] == 2018) & d["ar1"].notna()
    test = (d["anio_epi"] == 2019) & d["ar1"].notna()
    print(f"A. panel {PROVS}")
    print(f"   train 2018={int(train.sum())}  test 2019={int(test.sum())} filas provincia-semana")
    print(d.loc[d["anio_epi"].isin([2018, 2019])].groupby("provincia")["casos"].agg(["count", "mean", "max"]).to_string())

    y_tr = d.loc[train, "casos"].astype(float).values
    y_te = d.loc[test, "casos"].astype(float).values
    rows = []
    rows.append(metrics(y_te, np.full_like(y_te, y_tr.mean()), "ZONA|baseline_media", 1))
    # naive: repetir la semana anterior de ESA provincia (ar1 en test)
    rows.append(metrics(y_te, d.loc[test, "ar1"].astype(float).values, "ZONA|baseline_naive", 1))

    Xtr = sm.add_constant(d.loc[train, ["ar1"]].astype(float))
    Xte = sm.add_constant(d.loc[test, ["ar1"]].astype(float))
    mu = fit_glm_nb(Xtr, y_tr).predict(Xte)
    rows.append(metrics(y_te, np.asarray(mu), "ZONA|AR1_pooled", 2))

    # AR1 + dummy de provincia (efecto de nivel por zona)
    dum_tr = pd.get_dummies(d.loc[train, "provincia"], prefix="p", drop_first=True)
    dum_te = pd.get_dummies(d.loc[test, "provincia"], prefix="p", drop_first=True).reindex(
        columns=dum_tr.columns, fill_value=0
    )
    Xtr2 = sm.add_constant(pd.concat([d.loc[train, ["ar1"]].astype(float), dum_tr], axis=1).astype(float))
    Xte2 = sm.add_constant(pd.concat([d.loc[test, ["ar1"]].astype(float), dum_te], axis=1).astype(float))
    mu2 = fit_glm_nb(Xtr2, y_tr).predict(Xte2)
    rows.append(metrics(y_te, np.asarray(mu2), "ZONA|AR1_dummy_prov", Xtr2.shape[1]))

    feats = ["ar1", "semana"]
    d[feats] = d[feats].astype(float)
    model = xgb.XGBRegressor(
        n_estimators=200, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, objective="count:poisson", random_state=42,
    )
    # provincia como codigo
    d["pcode"] = pd.Categorical(d["provincia"], categories=PROVS).codes
    fx = feats + ["pcode"]
    model.fit(d.loc[train, fx], y_tr)
    mu3 = model.predict(d.loc[test, fx])
    rows.append(metrics(y_te, mu3, "ZONA|XGB_prov+AR1", 3))

    # MAE por provincia (naive vs mejor candidato AR1_dummy)
    by = []
    pred_ar = np.asarray(mu2)
    pred_nv = d.loc[test, "ar1"].astype(float).values
    te = d.loc[test].reset_index(drop=True)
    for p in PROVS:
        m = te["provincia"].values == p
        if m.sum() < 8:
            continue
        by.append(dict(
            provincia=p, n=int(m.sum()), media=float(te.loc[m, "casos"].mean()),
            MAE_naive=float(np.mean(np.abs(te.loc[m, "casos"] - pred_nv[m]))),
            MAE_AR1_zona=float(np.mean(np.abs(te.loc[m, "casos"] - pred_ar[m]))),
        ))
    by_df = pd.DataFrame(by)
    out = pd.DataFrame(rows)
    out.to_csv(os.path.join(RES, "test_zonas_provinciales.csv"), index=False)
    by_df.to_csv(os.path.join(RES, "test_zonas_provinciales_por_prov.csv"), index=False)

    print("\n=== A. metricas pooled (test 2019) ===")
    print(out[["modelo", "MAE", "RMSE", "N"]].to_string(index=False))
    print("\n=== A. por provincia ===")
    print(by_df.to_string(index=False))

    fig, ax = plt.subplots(figsize=(8, 3.8))
    x = np.arange(len(by_df))
    ax.bar(x - 0.18, by_df["MAE_naive"], 0.36, color="#94a3b8", label="naive (ultima semana)")
    ax.bar(x + 0.18, by_df["MAE_AR1_zona"], 0.36, color="#0f766e", label="AR1 + zona (provincia)")
    ax.set_xticks(x)
    ax.set_xticklabels(by_df["provincia"], rotation=15)
    ax.set_ylabel("MAE (test 2019)")
    ax.set_title("¿Predecir dengue por zona (provincia) gana al naive?")
    ax.legend(fontsize=8)
    savefig(os.path.join(FIG, "16_zonas_provinciales_mae.png"))
    return out, by_df


def flags_zona(texto):
    z = str(texto or "").lower()
    return pd.Series({
        "corte_norte": int("norte" in z or "noroeste" in z),
        "corte_sur": int("sur" in z or "suroeste" in z),
        "corte_centro": int("centro" in z),
    })


def parte_b():
    cortes = pd.read_csv(os.path.join(ROOT, "data", "clean", "cortes_interagua_clean.csv"))
    flags = cortes["zona_ciudad"].apply(flags_zona)
    cortes = pd.concat([cortes, flags], axis=1)
    wk = cortes.groupby("semana_id").agg(
        corte_norte=("corte_norte", "max"),
        corte_sur=("corte_sur", "max"),
        corte_centro=("corte_centro", "max"),
        horas_corte=("duracion_horas_num", "sum"),
        n_eventos=("semana_id", "count"),
    ).reset_index()

    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    df = df.merge(wk, on="semana_id", how="left", suffixes=("", "_zona"))
    for c in ("corte_norte", "corte_sur", "corte_centro"):
        df[c] = df[c].fillna(0)
    # overlap: muchos comunicados marcan norte Y sur la misma semana
    n_ns = int(((df["corte_norte"] == 1) & (df["corte_sur"] == 1) & df["casos_dengue_nacional"].notna()).sum())
    n_n = int(((df["corte_norte"] == 1) & df["casos_dengue_nacional"].notna()).sum())
    n_s = int(((df["corte_sur"] == 1) & df["casos_dengue_nacional"].notna()).sum())
    print(f"\nB. semanas NAT con corte norte={n_n} sur={n_s} ambas={n_ns}")

    df = add_autoregressive(df)
    nat = df["casos_dengue_nacional"].notna()
    train = nat & (df["anio_epi"] <= 2022)
    test = nat & (df["anio_epi"] == 2023)

    d_resid = fit_ar1_residuals(df, train)
    r_n = run_residual_test(d_resid, test, "corte_norte")
    r_s = run_residual_test(d_resid, test, "corte_sur")
    resid = pd.concat([r_n, r_s], ignore_index=True)
    resid.to_csv(os.path.join(RES, "test_zonas_corte_residual.csv"), index=False)
    print("\n=== B. residuo AR1 vs zona del corte (test 2023) ===")
    print(resid.to_string(index=False))

    y = df["casos_dengue_nacional"].astype(float)
    base = ["ar1_nac", "ar2_nac", "horas_corte", "corte_hn", "precipitacion_mm",
            "precip_30d", "tmin", "tmax", "humedad", "spi6", "semana"]
    extra = base + ["corte_norte", "corte_sur", "corte_centro"]

    def xgb_mae(feats, tag):
        ok = y.notna() & df[feats].notna().all(axis=1)
        tr, te = ok & train, ok & test
        m = xgb.XGBRegressor(
            n_estimators=300, max_depth=3, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, objective="count:poisson", random_state=42,
        )
        m.fit(df.loc[tr, feats].astype(float), y[tr])
        mu = m.predict(df.loc[te, feats].astype(float))
        out = metrics(y[te].values, mu, tag, n_params=len(feats))
        if tag.endswith("zona"):
            imp = pd.Series(m.feature_importances_, index=feats).sort_values(ascending=False)
            print("\nimportancia XGB con zona de corte:")
            print(imp.head(8).to_string())
        return out

    comp = pd.DataFrame([xgb_mae(base, "XGB_sin_zona_corte"), xgb_mae(extra, "XGB_con_zona_corte")])
    comp.to_csv(os.path.join(RES, "test_zonas_corte_xgb.csv"), index=False)
    print("\n=== B. XGB nacional ± zona del corte ===")
    print(comp[["modelo", "MAE", "RMSE"]].to_string(index=False))
    return resid, comp


def main():
    print("adm_2 OpenDengue Ecuador: vacio. No hay canton/parroquia/barrio.\n")
    parte_a()
    parte_b()
    print("\nEscrito: results/test_zonas_*.csv  figures/16_zonas_provinciales_mae.png")


if __name__ == "__main__":
    main()
