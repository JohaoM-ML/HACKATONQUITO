"""
test_radiacion.py — VENTANA SECA (prueba exploratoria, NO parte del pipeline)

Pregunta: ¿aporta radiacion solar (proxy de UV, ver nota abajo) algo que el
resto de variables no aporte ya?

NOTA IMPORTANTE: Open-Meteo ERA5 archive NO tiene uv_index historico (solo
pronostico a corto plazo). El proxy real disponible con historia completa es
shortwave_radiation_sum (radiacion de onda corta, MJ/m2), altamente
correlacionada con UV. Se usa como sustituto honesto.

Metodologia: dos pruebas independientes, mismas que se han usado para todo lo
demas en esta serie de experimentos:
  1. Test de residuos: ¿radiacion explica lo que el AR1 (inercia+estacionalidad)
     no explica?
  2. Comparacion directa: XGB_completo (sin radiacion) vs XGB_completo+radiacion,
     mismo train/test, para ver si el MAE mejora de verdad.

Si no gana en NINGUNA de las dos pruebas, no se integra al dataset.
No escribe nada en data/model/ — es solo para decidir.
"""
import os
import sys
import warnings
import urllib.request
import urllib.parse
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import xgboost as xgb

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import DATA, RES, FIG, metrics, savefig
from run_experiments_extra import add_autoregressive, fit_ar1_residuals, run_residual_test

LAT, LON = -2.19, -79.88
TZ = "America/Guayaquil"


def fetch_weekly_radiation(start, end):
    params = {
        "latitude": LAT, "longitude": LON,
        "start_date": start, "end_date": end,
        "daily": "shortwave_radiation_sum",
        "timezone": TZ,
    }
    url = "https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=120) as r:
        d = json.load(r)
    df = pd.DataFrame(d["daily"])
    df["time"] = pd.to_datetime(df["time"])
    iso = df["time"].dt.isocalendar()
    df["anio_epi"] = iso["year"].values
    df["semana"] = iso["week"].values
    wk = df.groupby(["anio_epi", "semana"]).agg(
        n_dias=("time", "count"),
        radiacion=("shortwave_radiation_sum", "mean"),
    ).reset_index()
    wk = wk[wk["n_dias"] == 7]
    wk["semana_id"] = wk["anio_epi"].astype(str) + "-W" + wk["semana"].astype(str).str.zfill(2)
    return wk[["semana_id", "radiacion"]]


def main():
    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    df = add_autoregressive(df)

    print("Descargando radiacion Open-Meteo (proxy UV)...")
    rad = fetch_weekly_radiation("2020-11-01", "2023-12-31")
    df = df.merge(rad, on="semana_id", how="left")
    print(f"  semanas con radiacion: {df['radiacion'].notna().sum()} / {len(df)}")

    nat_ok = df["casos_dengue_nacional"].notna()
    train_nat = nat_ok & (df["anio_epi"] <= 2022)
    test_nat = nat_ok & (df["anio_epi"] == 2023)

    # --- prueba 1: test de residuos ---
    d_resid = fit_ar1_residuals(df, train_nat)
    resid_res = run_residual_test(d_resid, test_nat, "radiacion")
    print("\n[Prueba 1] Correlacion residuo(AR1) vs radiacion por lag (test 2023):")
    print(resid_res.to_string(index=False))

    # --- prueba 2: XGBoost con vs sin radiacion ---
    feats_base = ["ar1_nac", "ar2_nac", "horas_corte", "corte_hn", "precipitacion_mm",
                  "precip_30d", "tmin", "tmax", "humedad", "spi6", "semana"]
    feats_rad = feats_base + ["radiacion"]

    d = df.copy()
    for f in feats_rad:
        d[f] = d[f].astype(float)
    y = d["casos_dengue_nacional"].astype(float)

    def run_xgb(feats, label):
        ok = y.notna() & d[feats].notna().all(axis=1)
        tr = ok & train_nat.values
        te = ok & test_nat.values
        model = xgb.XGBRegressor(
            n_estimators=300, max_depth=3, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
            objective="count:poisson", random_state=42,
        )
        model.fit(d.loc[tr, feats], y[tr])
        mu = model.predict(d.loc[te, feats])
        m = metrics(y[te].values, mu, label, n_params=len(feats))
        m["N_train"] = int(tr.sum())
        imp = pd.Series(model.feature_importances_, index=feats).sort_values(ascending=False)
        return m, imp

    m_base, imp_base = run_xgb(feats_base, "XGB_sin_radiacion")
    m_rad, imp_rad = run_xgb(feats_rad, "XGB_con_radiacion")

    comp = pd.DataFrame([m_base, m_rad])
    comp.to_csv(os.path.join(RES, "test_radiacion_comparacion.csv"), index=False)

    print("\n[Prueba 2] XGBoost sin vs con radiacion (mismo train/test 2023):")
    print(comp[["modelo", "MAE", "RMSE", "LogScore", "N_train"]].to_string(index=False))
    print("\nImportancia de 'radiacion' en el modelo con radiacion:")
    print(imp_rad.to_string())

    plt.figure(figsize=(6, 3.6))
    plt.bar(comp["modelo"], comp["MAE"], color=["#334155", "#0f766e"])
    plt.ylabel("MAE (test 2023)")
    plt.title("¿Radiacion mejora XGBoost?")
    savefig(os.path.join(FIG, "11_radiacion_xgb_comparacion.png"))

    mejora = m_base["MAE"] - m_rad["MAE"]
    print(f"\nCambio en MAE al agregar radiacion: {mejora:+.2f} "
          f"({'mejora' if mejora > 0 else 'empeora o no cambia'})")


if __name__ == "__main__":
    main()
