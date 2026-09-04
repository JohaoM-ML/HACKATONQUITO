"""
tablero_dos_piezas.py — VENTANA SECA

Une las dos preguntas que SI tienen Y publica, en el unico anio donde
coinciden (2023): dengue nacional semanal + cortes de Guayaquil.

  Pieza 1  pronostico nacional (AR1, train 2021-22 / test 2023)
  Pieza 2  cola Regla A: corte >=8 h + almacenar + 0-14 dias

NO es prediccion por barrio. NO atribuye casos a la cola.
La figura muestra las DOS series en el mismo calendario: carga del pais
y barrios a los que la app habria mandado brigada.

Salidas:
  results/tablero_2023_semanal.csv
  results/tablero_dos_piezas.json
  results/figures/17_dos_piezas_2023.png
"""
import json
import os
import sys
import warnings

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import DATA, RES, FIG, design, fit_glm, predict_mu, savefig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_barrios():
    p = os.path.join(ROOT, "data", "barrios_cortes.csv")
    b = pd.read_csv(p)
    b["fecha_corte"] = pd.to_datetime(b["fecha_corte"], errors="coerce")
    b["duracion_horas_num"] = pd.to_numeric(b["duracion_horas_num"], errors="coerce")
    b["pidio_almacenar"] = b["pidio_almacenar"].astype(str).str.lower().isin(("si", "sí", "1", "true"))
    return b.dropna(subset=["fecha_corte"])


def unique_latest(df):
    return df.sort_values("fecha_corte").drop_duplicates("id", keep="last")


def regla_a(barrios, fecha_eval):
    """Misma regla A que src/motor/reglas.js. Un barrio por id (corte mas reciente)."""
    ev = pd.Timestamp(fecha_eval)
    cand = unique_latest(barrios[barrios["fecha_corte"] <= ev])
    dias = (ev - cand["fecha_corte"]).dt.days
    ok = (
        cand["duracion_horas_num"].notna()
        & (cand["duracion_horas_num"] >= 8)
        & (dias >= 0)
        & (dias <= 14)
        & cand["pidio_almacenar"]
    )
    return cand.loc[ok]


def pieza1_nacional(df):
    d = df.sort_values("fecha_lunes").reset_index(drop=True)
    d["ar1_nac"] = d["casos_dengue_nacional"].shift(1)
    nat = d["casos_dengue_nacional"].notna()
    train = nat & (d["anio_epi"] <= 2022) & d["ar1_nac"].notna()
    test = nat & (d["anio_epi"] == 2023) & d["ar1_nac"].notna()
    X, y, pop, ok, names = design(
        d, "casos_dengue_nacional", [("ar1_nac", False, 0)],
        maxlag=0, with_harmonics=False, with_year=False,
    )
    tr, te = ok & train.values, ok & test.values
    res, fam, alpha = fit_glm(X[tr], y[tr], pop[tr], "nb")
    mu = np.full(len(d), np.nan)
    mu[ok] = predict_mu(res, X[ok], pop[ok])
    d["pred_ar1"] = mu
    mae = float(np.mean(np.abs(y[te] - mu[te])))
    coef = {names[i]: float(res.params[i]) for i in range(len(names))}
    return d, dict(
        mae_test_2023=round(mae, 1),
        n_test=int(te.sum()),
        familia=fam,
        alpha_nb=float(alpha) if alpha is not None else None,
        intercept=coef.get("intercept"),
        coef_ar1=coef.get("ar1_nac"),
        formula="mu = exp(intercept + coef_ar1 * casos(t-1) + log(poblacion))",
        nota="Pronostico NACIONAL. No define barrio. No usa cortes.",
    )


def main():
    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    d, p1 = pieza1_nacional(df)
    barrios = load_barrios()
    cortes = pd.read_csv(os.path.join(ROOT, "data", "clean", "cortes_interagua_clean.csv"))

    # --- cobertura del calendario de cortes (toda la serie, no solo 2023) ---
    n_ev = len(cortes)
    con_dur = int(pd.to_numeric(cortes["duracion_horas_num"], errors="coerce").notna().sum())
    con_almac = int((cortes["almacenar"] == 1).sum()) if "almacenar" in cortes.columns else 0
    nombrados = int((cortes["n_sectores_listados"] > 0).sum()) if "n_sectores_listados" in cortes.columns else 0

    rows = []
    for _, w in d[d["anio_epi"] == 2023].iterrows():
        ev = w["fecha_lunes"]
        a = regla_a(barrios, ev)
        rows.append(dict(
            semana_id=w["semana_id"],
            fecha_lunes=ev.date().isoformat(),
            casos_obs=w["casos_dengue_nacional"],
            casos_pred_ar1=w["pred_ar1"],
            n_regla_a=int(len(a)),
            barrios_a=";".join(sorted(a["nombre"].astype(str))) if len(a) else "",
        ))
    tab = pd.DataFrame(rows)
    tab.to_csv(os.path.join(RES, "tablero_2023_semanal.csv"), index=False)

    semanas_cola = int((tab["n_regla_a"] > 0).sum())
    visitas = int(tab["n_regla_a"].sum())  # barrio-semanas A
    unicos_a = set()
    for s in tab["barrios_a"]:
        if s:
            unicos_a.update(s.split(";"))
    p75 = float(tab["casos_obs"].quantile(0.75))
    altas = tab["casos_obs"] >= p75
    cola = tab["n_regla_a"] > 0
    # coincidencia descriptiva, NO causal
    ambas = int((altas & cola).sum())
    solo_alta = int((altas & ~cola).sum())
    solo_cola = int((~altas & cola).sum())

    universo = int(barrios["id"].nunique())
    visitas_ciegas = universo * 52
    concentracion = round(100 * (1 - visitas / visitas_ciegas), 2) if visitas_ciegas else None

    c23 = cortes[cortes["anio"] == 2023] if "anio" in cortes.columns else cortes.iloc[0:0]
    n23 = len(c23)
    dur23 = int(pd.to_numeric(c23["duracion_horas_num"], errors="coerce").notna().sum()) if n23 else 0
    al23 = int((c23["almacenar"] == 1).sum()) if n23 and "almacenar" in c23.columns else 0

    resumen = {
        "pieza_1": p1,
        "pieza_2": {
            "n_eventos_corte": n_ev,
            "pct_con_duracion": round(100 * con_dur / n_ev, 1) if n_ev else None,
            "pct_pidio_almacenar": round(100 * con_almac / n_ev, 1) if n_ev else None,
            "pct_con_sectores_nombrados": round(100 * nombrados / n_ev, 1) if n_ev else None,
            "semanas_2023_con_cola_a": semanas_cola,
            "barrio_semanas_a_2023": visitas,
            "barrios_distintos_a_2023": len(unicos_a),
            "barrios_unicos_en_csv": universo,
            "visitas_si_se_recorre_catalogo_cada_semana": visitas_ciegas,
            "pct_trabajo_evitado_vs_visitar_todos_cada_semana": concentracion,
            "cortes_2023": n23,
            "cortes_2023_con_duracion": dur23,
            "cortes_2023_sin_horas": n23 - dur23,
            "cortes_2023_pidio_almacenar": al23,
            "regla": "A = >=8 h + almacenar + 0-14 dias. Ranking operativo, no P(brote).",
        },
        "coincidencia_2023": {
            "umbral_semana_alta_p75": p75,
            "semanas_alta_y_cola": ambas,
            "semanas_alta_sin_cola": solo_alta,
            "semanas_cola_sin_alta": solo_cola,
            "nota": (
                "Conteo descriptivo en el mismo calendario. "
                "NO es evidencia de que la cola predice dengue ni lo contrario."
            ),
        },
    }
    with open(os.path.join(RES, "tablero_dos_piezas.json"), "w", encoding="utf-8") as f:
        json.dump(resumen, f, ensure_ascii=False, indent=2)

    # --- figura ---
    fig, ax1 = plt.subplots(figsize=(11, 4.2))
    t = pd.to_datetime(tab["fecha_lunes"])
    ax1.fill_between(t, 0, tab["casos_obs"], color="#1d4ed8", alpha=0.12)
    ax1.plot(t, tab["casos_obs"], color="#1d4ed8", lw=1.6, label="dengue nacional (obs)")
    ax1.plot(t, tab["casos_pred_ar1"], color="#b45309", lw=1.4, ls="--", label=f"AR1 predicho (MAE {p1['mae_test_2023']})")
    ax1.set_ylabel("casos nacionales / semana", color="#1d4ed8")
    ax1.set_ylim(0, max(tab["casos_obs"].max(), tab["casos_pred_ar1"].max()) * 1.15)
    ax2 = ax1.twinx()
    ax2.bar(t, tab["n_regla_a"], width=6, color="#0f766e", alpha=0.55, label="barrios Regla A (cola)")
    ax2.set_ylabel("barrios en cola A", color="#0f766e")
    ax2.set_ylim(0, max(int(tab["n_regla_a"].max()) + 2, 6))
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1 + h2, l1 + l2, loc="upper left", fontsize=8)
    ax1.set_title("2023: carga nacional (se predice) + cola de brigada (se rutea)\n"
                  "Dos preguntas, dos Y. La cola no pretende explicar la curva.")
    savefig(os.path.join(FIG, "17_dos_piezas_2023.png"))

    print("=== PIEZA 1 — nacional ===")
    print(f"  MAE AR1 test 2023: {p1['mae_test_2023']}  (n={p1['n_test']})")
    print("=== PIEZA 2 — cola ===")
    print(f"  eventos corte: {n_ev}  con duracion: {con_dur} ({resumen['pieza_2']['pct_con_duracion']}%)")
    print(f"  2023: {semanas_cola}/52 semanas con cola A  |  {visitas} barrio-semanas  |  {len(unicos_a)} barrios distintos")
    print(f"  vs visitar {universo} barrios × 52 sem: se evita el {concentracion}% de visitas vacias")
    print("=== coincidencia (NO causal) ===")
    print(f"  alta+cola={ambas}  alta sin cola={solo_alta}  cola sin alta={solo_cola}  (p75={p75:.0f})")
    print("Escrito: results/tablero_dos_piezas.json  figures/17_dos_piezas_2023.png")


if __name__ == "__main__":
    main()
