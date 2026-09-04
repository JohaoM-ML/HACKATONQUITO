"""
test_guayas_opendengue.py — VENTANA SECA (prueba exploratoria, NO parte del pipeline)

Hallazgo: OpenDengue Spatial_extract_V1_3 tiene dengue SEMANAL a nivel de
PROVINCIA GUAYAS (no nacional, no digitalizado de PDF) para 2013-2020, con
un bloque continuo de 120/121 semanas en 2018-2020. Nadie lo habia usado —
el pipeline actual solo usaba National_extract (Ecuador entero) o la serie
2026 digitalizada de la Gaceta MSP (33 semanas, confianza B).

Esto es una serie MEJOR para el objetivo real (predecir dengue en Guayas):
misma escala geografica de los cortes/clima, 4x mas observaciones que la
serie 2026, y confianza A (dato cientifico, no digitalizado a mano).

LIMITACION HONESTA: no hay poblacion de Guayaquil para 2013-2020 en el repo
(solo 2021-2026, INEC). Se usa sin offset de poblacion en esta prueba —
aceptable para comparar modelos entre si, no para tasas per-capita reales.
LIMITACION 2: no hay cortes de agua para 2013-2020 (solo scrapeados desde
2021) — esta prueba es SOLO clima+AR1, no puede tocar la pregunta de cortes.

Pregunta que responde: ¿un modelo a la escala geografica CORRECTA (Guayas,
no nacional) con clima+AR1 predice mejor que lo que tenemos ahora?
"""
import os
import sys
import warnings
import io
import zipfile
import urllib.request
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import statsmodels.api as sm
import xgboost as xgb

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import RES, FIG, metrics, savefig, harmonics

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://github.com/OpenDengue/master-repo/raw/main/data/releases/V1.3/Spatial_extract_V1_3.zip"


def fetch_guayas_opendengue():
    data = urllib.request.urlopen(URL, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(data))
    name = z.namelist()[0]
    df = pd.read_csv(z.open(name), low_memory=False)
    g = df[(df["adm_0_name"].str.contains("Ecuador", case=False, na=False)) &
           (df["adm_1_name"] == "GUAYAS") & (df["T_res"] == "Week")].copy()
    g["calendar_start_date"] = pd.to_datetime(g["calendar_start_date"])
    g = g.sort_values("calendar_start_date").reset_index(drop=True)
    iso = g["calendar_start_date"].dt.isocalendar()
    g["anio_epi"] = iso["year"].values
    g["semana"] = iso["week"].values
    g["semana_id"] = g["anio_epi"].astype(str) + "-W" + g["semana"].astype(str).str.zfill(2)
    g = g.rename(columns={"dengue_total": "casos_guayas"})
    out = g[["semana_id", "anio_epi", "semana", "calendar_start_date", "casos_guayas"]]
    out.to_csv(os.path.join(ROOT, "data", "raw", "dengue_guayas_opendengue_2013_2020.csv"), index=False)
    return out


def build_series():
    g = fetch_guayas_opendengue()
    clima = pd.read_csv(os.path.join(ROOT, "data", "clean", "clima_guayaquil_semanal.csv"))
    clima = clima.drop(columns=["anio_epi", "semana"], errors="ignore")
    df = g.merge(clima, on="semana_id", how="left")
    df = df.sort_values("calendar_start_date").reset_index(drop=True)
    # continuidad real: filtrar solo filas con gap de 7 dias respecto a la anterior
    # (evita mezclar el bloque 2013 aislado con el bloque 2017-2020)
    df["gap"] = df["calendar_start_date"].diff().dt.days
    df["bloque"] = (df["gap"] != 7).cumsum()
    tam_bloque = df.groupby("bloque")["bloque"].transform("count")
    df = df[tam_bloque >= 40].copy()  # quedarnos con el bloque largo (2018-2020)
    df["ar1"] = df["casos_guayas"].shift(1)
    df["ar2"] = df["casos_guayas"].shift(2)
    df = df.reset_index(drop=True)
    df["t"] = np.arange(len(df))
    return df


def fit_glm_nb(X, y):
    pois = sm.GLM(y, X, family=sm.families.Poisson()).fit(disp=0)
    mu = pois.fittedvalues
    pearson = np.sum((y - mu) ** 2 / np.maximum(mu, 1e-8))
    disp = pearson / max(pois.df_resid, 1)
    if disp <= 1.5:
        return pois, "poisson"
    alpha = max((pearson - pois.df_resid) / np.sum(mu), 1e-6)
    nb = sm.GLM(y, X, family=sm.families.NegativeBinomial(alpha=alpha)).fit(disp=0)
    return nb, "nb"


def main():
    print("Descargando OpenDengue Spatial extract (provincia GUAYAS)...")
    df = build_series()
    print(f"  bloque continuo usado: {len(df)} semanas, "
          f"{df['semana_id'].iloc[0]} -> {df['semana_id'].iloc[-1]}")
    print(f"  casos: media={df['casos_guayas'].mean():.1f} min={df['casos_guayas'].min():.0f} "
          f"max={df['casos_guayas'].max():.0f}")

    n = len(df)
    # OJO: el bloque llega hasta 2020-W40 -> las ultimas semanas caen en pleno
    # colapso COVID de Guayaquil (abril-oct 2020), vigilancia de dengue
    # casi seguro contaminada. Usamos como test 2019 completo (pre-COVID),
    # no la cola de la serie.
    test_mask = (df["anio_epi"] == 2019)
    train_mask = (df["anio_epi"] == 2018)
    print(f"  train={train_mask.sum()} (2018) test={test_mask.sum()} (2019, pre-COVID)")

    y = df["casos_guayas"].astype(float).values
    results = []

    # baseline
    y_tr, y_te = y[train_mask.values], y[test_mask.values]
    mu_media = np.full_like(y_te, y_tr.mean())
    results.append(metrics(y_te, mu_media, "GYA2|baseline_media", 1))
    mu_naive = np.full_like(y_te, y_tr[-1])
    results.append(metrics(y_te, mu_naive, "GYA2|baseline_naive", 1))

    # AR1 solo (GLM)
    ok = df["ar1"].notna().values
    Xar1 = sm.add_constant(df.loc[ok, "ar1"].values)
    ytr = y[ok & train_mask.values]
    yte = y[ok & test_mask.values]
    Xtr = Xar1[(ok & train_mask.values)[ok]]
    Xte = Xar1[(ok & test_mask.values)[ok]]
    mod, fam = fit_glm_nb(Xtr, ytr)
    mu = mod.predict(Xte)
    results.append(metrics(yte, mu, "GYA2|AR1", n_params=2))

    # AR1 + clima + estacionalidad (GLM)
    feats_glm = ["ar1", "precipitacion_mm", "tmin", "humedad", "spi6"]
    ok2 = df[feats_glm].notna().all(axis=1).values
    H = harmonics(df["semana"].values, k=2)
    Xfull = np.column_stack([np.ones(n), df[feats_glm].fillna(0).values, H])
    ytr = y[ok2 & train_mask.values]
    yte = y[ok2 & test_mask.values]
    Xtr = Xfull[ok2 & train_mask.values]
    Xte = Xfull[ok2 & test_mask.values]
    mod2, fam2 = fit_glm_nb(Xtr, ytr)
    mu2 = mod2.predict(Xte)
    results.append(metrics(yte, mu2, "GYA2|AR1_clima_estacion", n_params=Xfull.shape[1]))

    # XGBoost
    feats_xgb = ["ar1", "ar2", "precipitacion_mm", "precip_30d", "tmin", "tmax",
                 "humedad", "spi6", "semana"]
    d = df.copy()
    for f in feats_xgb:
        d[f] = d[f].astype(float)
    ok3 = d[feats_xgb].notna().all(axis=1).values
    tr3 = ok3 & train_mask.values
    te3 = ok3 & test_mask.values
    model = xgb.XGBRegressor(n_estimators=200, max_depth=3, learning_rate=0.05,
                              subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
                              objective="count:poisson", random_state=42)
    model.fit(d.loc[tr3, feats_xgb], y[tr3])
    mu3 = model.predict(d.loc[te3, feats_xgb])
    m3 = metrics(y[te3], mu3, "GYA2|XGBoost", n_params=len(feats_xgb))
    results.append(m3)
    imp = pd.Series(model.feature_importances_, index=feats_xgb).sort_values(ascending=False)

    out = pd.DataFrame(results)
    out.to_csv(os.path.join(RES, "test_guayas_opendengue_metrics.csv"), index=False)
    imp.to_frame("importancia").to_csv(os.path.join(RES, "test_guayas_opendengue_xgb_importance.csv"))

    print("\n=== Resultados (test = ultimas 24 semanas del bloque 2018-2020) ===")
    print(out[["modelo", "MAE", "RMSE", "LogScore", "N"]].to_string(index=False))
    print("\nImportancia XGBoost:")
    print(imp.to_string())

    plt.figure(figsize=(9, 3.4))
    plt.plot(df.loc[test_mask.values, "calendar_start_date"], y[test_mask.values],
              label="observado", color="#1d4ed8", marker="o", ms=3)
    plt.plot(df.loc[(te3), "calendar_start_date"], mu3, label="XGBoost", color="#b45309")
    plt.legend()
    plt.title("Guayas (OpenDengue 2018-2020): observado vs XGBoost")
    savefig(os.path.join(FIG, "13_guayas_opendengue_pred.png"))


if __name__ == "__main__":
    main()
