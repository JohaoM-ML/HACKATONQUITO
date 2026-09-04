"""
test_enso_rain_events.py — VENTANA SECA (prueba exploratoria, NO parte del pipeline)

Tres pruebas independientes, mismo criterio de siempre: si no gana en la prueba,
no se integra.

1. ENSO (indice ONI / Nino3.4, NOAA, mensual->semanal): pendiente desde hace
   varios turnos, referencia Lowe et al. 2017 (Machala, Ecuador).
2. Lluvia extrema (dias>10mm, precip max de 1 dia por semana): referencia
   Porto Alegre (dias lluviosos > promedio de lluvia para infestacion Aedes).
3. Analisis de eventos apilados (superposed epoch analysis) de los cortes de
   agua sobre el residuo AR1: adaptacion correcta de "interrupted time series"
   para exposicion REPETIDA (61 eventos dispersos), no un solo cambio de
   politica. CausalImpact/ITS clasico no aplica porque no hay serie de
   control paralela (misma serie nacional es la tratada).
"""
import os
import sys
import warnings
import urllib.request
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import xgboost as xgb
from scipy import stats

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import DATA, RES, FIG, metrics, savefig
from run_experiments_extra import add_autoregressive, fit_ar1_residuals, run_residual_test

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ---------- 1. ENSO / ONI ----------
def fetch_oni():
    url = "https://psl.noaa.gov/data/correlation/oni.data"
    with urllib.request.urlopen(url, timeout=60) as r:
        txt = r.read().decode("utf-8", errors="replace")
    rows = []
    for line in txt.splitlines():
        parts = line.split()
        if len(parts) == 13 and parts[0].isdigit() and 1900 < int(parts[0]) < 2100:
            year = int(parts[0])
            for m, v in enumerate(parts[1:], start=1):
                val = float(v)
                if val < -90:  # NOAA usa -99.9 como NA
                    continue
                rows.append(dict(anio=year, mes=m, oni=val))
    return pd.DataFrame(rows)


def add_oni(df):
    oni = fetch_oni()
    d = df.copy()
    d["anio_mes"] = d["fecha_lunes"].dt.year * 100 + d["fecha_lunes"].dt.month
    oni["anio_mes"] = oni["anio"] * 100 + oni["mes"]
    d = d.merge(oni[["anio_mes", "oni"]], on="anio_mes", how="left")
    return d


# ---------- 2. lluvia extrema ----------
def add_extreme_rain(df):
    clima = pd.read_csv(os.path.join(ROOT, "data", "raw", "clima_guayaquil_diario.csv"))
    clima["time"] = pd.to_datetime(clima["time"])
    iso = clima["time"].dt.isocalendar()
    clima["semana_id"] = iso["year"].astype(str) + "-W" + iso["week"].astype(str).str.zfill(2)
    wk = clima.groupby("semana_id").agg(
        n_dias=("time", "count"),
        dias_gt10mm=("precipitation_sum", lambda s: int((s > 10).sum())),
        max_1day_precip=("precipitation_sum", "max"),
    ).reset_index()
    wk = wk[wk["n_dias"] == 7].drop(columns="n_dias")
    return df.merge(wk, on="semana_id", how="left")


# ---------- 3. eventos apilados ----------
def superposed_epoch(d_resid, event_mask, window=(0, 20), n_boot=2000, seed=42):
    """Alinea cada semana con corte_hn==1 en t=0 y agrega el residuo AR1 de las
    W semanas siguientes. Compara contra una distribucion nula por bootstrap
    (remuestreo de fechas de evento al azar dentro de la misma serie)."""
    rng = np.random.default_rng(seed)
    resid = d_resid["resid_ar1"].values
    n = len(resid)
    idx_events = np.where(event_mask.values & d_resid["resid_ar1"].notna().values)[0]
    lo, hi = window

    def stack(idx_list):
        rows = []
        for i in idx_list:
            for L in range(lo, hi + 1):
                j = i + L
                if 0 <= j < n and np.isfinite(resid[j]):
                    rows.append((L, resid[j]))
        return pd.DataFrame(rows, columns=["lag", "resid"])

    obs = stack(idx_events)
    obs_curve = obs.groupby("lag")["resid"].mean()

    valid_start = np.where(d_resid["resid_ar1"].notna().values)[0]
    boots = np.zeros((n_boot, len(obs_curve)))
    for b in range(n_boot):
        fake = rng.choice(valid_start, size=len(idx_events), replace=False)
        bc = stack(fake).groupby("lag")["resid"].mean().reindex(obs_curve.index)
        boots[b] = bc.values
    lo_ci = np.nanpercentile(boots, 2.5, axis=0)
    hi_ci = np.nanpercentile(boots, 97.5, axis=0)
    p_global = float(np.mean(np.nanmean(np.abs(boots), axis=1) >= np.nanmean(np.abs(obs_curve.values))))

    out = pd.DataFrame({"lag": obs_curve.index, "resid_medio": obs_curve.values,
                        "null_lo95": lo_ci, "null_hi95": hi_ci})
    out["fuera_de_banda_null"] = (out["resid_medio"] < out["null_lo95"]) | (out["resid_medio"] > out["null_hi95"])
    return out, p_global, len(idx_events)


def run_xgb_compare(d, feats_base, feats_new, y, train_mask, test_mask, label):
    def _run(feats, tag):
        dd = d.copy()
        for f in feats:
            dd[f] = dd[f].astype(float)
        ok = y.notna() & dd[feats].notna().all(axis=1)
        tr = ok & train_mask.values
        te = ok & test_mask.values
        model = xgb.XGBRegressor(n_estimators=300, max_depth=3, learning_rate=0.05,
                                  subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
                                  objective="count:poisson", random_state=42)
        model.fit(dd.loc[tr, feats], y[tr])
        mu = model.predict(dd.loc[te, feats])
        m = metrics(y[te].values, mu, f"{label}_{tag}", n_params=len(feats))
        m["N_train"] = int(tr.sum())
        return m
    m_base = _run(feats_base, "base")
    m_new = _run(feats_new, "nuevo")
    return pd.DataFrame([m_base, m_new])


def main():
    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    df = add_autoregressive(df)
    print("Descargando ONI (NOAA)...")
    df = add_oni(df)
    print(f"  semanas con ONI: {df['oni'].notna().sum()} / {len(df)}")
    print("Calculando lluvia extrema...")
    df = add_extreme_rain(df)
    print(f"  semanas con dias_gt10mm: {df['dias_gt10mm'].notna().sum()} / {len(df)}")

    nat_ok = df["casos_dengue_nacional"].notna()
    train_nat = nat_ok & (df["anio_epi"] <= 2022)
    test_nat = nat_ok & (df["anio_epi"] == 2023)
    y = df["casos_dengue_nacional"].astype(float)

    d_resid = fit_ar1_residuals(df, train_nat)

    print("\n=== 1. ENSO/ONI ===")
    r_oni = run_residual_test(d_resid, test_nat, "oni")
    print(r_oni.to_string(index=False))

    feats_base = ["ar1_nac", "ar2_nac", "horas_corte", "corte_hn", "precipitacion_mm",
                  "precip_30d", "tmin", "tmax", "humedad", "spi6", "semana"]
    comp_oni = run_xgb_compare(df, feats_base, feats_base + ["oni"], y, train_nat, test_nat,
                                "XGB")
    comp_oni["variable"] = "oni"
    print(comp_oni[["modelo", "MAE", "LogScore"]].to_string(index=False))

    print("\n=== 2. Lluvia extrema ===")
    r_rain1 = run_residual_test(d_resid, test_nat, "dias_gt10mm")
    r_rain2 = run_residual_test(d_resid, test_nat, "max_1day_precip")
    print(pd.concat([r_rain1, r_rain2]).to_string(index=False))

    comp_rain = run_xgb_compare(df, feats_base, feats_base + ["dias_gt10mm", "max_1day_precip"],
                                y, train_nat, test_nat, "XGB")
    comp_rain["variable"] = "lluvia_extrema"
    print(comp_rain[["modelo", "MAE", "LogScore"]].to_string(index=False))

    print("\n=== 3. Eventos apilados (superposed epoch) sobre corte_hn ===")
    event_mask = (df["corte_hn"] == 1)
    ev_out, p_global, n_ev = superposed_epoch(d_resid, event_mask, window=(0, 20))
    print(f"  eventos usados: {n_ev}  |  p global (permutacion): {p_global:.3f}")
    print(ev_out.to_string(index=False))

    plt.figure(figsize=(8, 3.6))
    plt.axhline(0, color="#999", lw=0.8)
    plt.fill_between(ev_out["lag"], ev_out["null_lo95"], ev_out["null_hi95"],
                      color="#94a3b8", alpha=0.4, label="banda nula (permutacion 95%)")
    plt.plot(ev_out["lag"], ev_out["resid_medio"], color="#b45309", marker="o", ms=3,
              label="residuo medio observado")
    plt.xlabel("semanas desde el inicio del corte")
    plt.ylabel("residuo AR1 medio")
    plt.title(f"Eventos apilados de corte (n={n_ev}) vs banda nula")
    plt.legend(fontsize=8)
    savefig(os.path.join(FIG, "12_eventos_apilados_corte.png"))

    # --- resumen final ---
    resumen = pd.concat([comp_oni, comp_rain], ignore_index=True)
    resumen.to_csv(os.path.join(RES, "test_enso_rain_events.csv"), index=False)
    ev_out.to_csv(os.path.join(RES, "eventos_apilados_corte.csv"), index=False)

    print("\n=== RESUMEN ===")
    print(resumen[["variable", "modelo", "MAE"]].to_string(index=False))
    base_mae = comp_oni[comp_oni["modelo"] == "XGB"]["MAE"].iloc[0]
    print(f"\nXGB base (mismo feats que antes, referencia): MAE={base_mae:.1f}")


if __name__ == "__main__":
    main()
