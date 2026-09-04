"""
test_historia_extendida.py — VENTANA SECA (prueba exploratoria, NO parte del pipeline)

VEREDICTO (leer antes de usar): la hipotesis de este script SE REFUTO.
  1. Extender el entrenamiento de 102 a 360 semanas EMPEORA todo:
     AR1 MAE 91->166, XGB MAE 58->120, y el recall de semanas altas cae a 0.00
     en ambos. Causa: la serie nacional tiene saltos de nivel enormes entre anios
     (media semanal 2018=60 vs 2015=805, 13x) que mezclan epidemiologia real con
     cambios de reporte. Mas anios != mas senal para predecir el NIVEL de 2023.
     => NO integrar. La ventana 2021-2022 se queda.
  2. El hallazgo util aparecio en la seccion de horizonte, no en la de historia:
     el aviso conserva capacidad de deteccion util hasta ~4 semanas de
     anticipacion (AUC 0.90, recall 0.77) y se degrada despues (h=8: recall 0.15).

Pregunta que responde
---------------------
Los experimentos previos entrenan con 102 semanas (2021-2022) y prueban en 2023.
Con esa ventana, el maximo observado en train es 749 casos y el modelo nunca ve
un pico de El Nino fuerte. Pero data/raw/dengue_ecuador_nacional_semanal_opendengue.csv
YA tiene 418 semanas (2015-W01 a 2023-W52) y data/clean/clima_guayaquil_semanal.csv
cubre 1991-2026. El cuello de botella no era la descarga: es que
data/model/ventana_seca_guayaquil_weekly.csv esta recortado a 2021+ porque ahi
empieza la cobertura de cortes de agua.

Este script reconstruye la serie SIN cortes (que aportan ~1.5% de importancia y
ningun lag significativo) para poder usar 2015-2019, y mide dos cosas:

  1. ¿Baja el MAE al triplicar el entrenamiento?
  2. ¿Se arregla el colapso de recall? XGB_completo tiene MAE 61 pero recall 0.077
     sobre semanas altas: su prediccion maxima (666.9) apenas cruza el umbral p75
     del test (662.5), asi que marca 1 de 52 semanas. AR1, con MAE peor (89.9),
     marca 17 y captura 12 de 13 semanas altas (AUC 0.949). La hipotesis es que el
     techo de XGB viene de no haber visto nunca un pico grande en train.

Mismo criterio de siempre: si no gana, no se integra. El test se mantiene en 2023
para que la unica cosa que cambia respecto de run_experiments_extra.py sea el
tamano del entrenamiento.

LIMITACIONES (no borrar)
  - 2020 tiene 1 sola semana en OpenDengue (colapso de vigilancia por COVID en
    Ecuador). Se excluye el anio entero y se rompe la continuidad de ar1/ar2 ahi.
  - poblacion_guayaquil_anual.csv solo cubre 2021-2026. Para 2015-2020 se
    retropola con la tasa media anual observada. El offset log(pop) varia ~1%/anio,
    asi que el efecto sobre el ranking de modelos es despreciable, pero es una
    extrapolacion, no un dato observado.
  - El offset usa poblacion de Guayaquil sobre casos NACIONALES. Es una herencia
    del pipeline original, no una decision de este script; se mantiene para que la
    comparacion contra metrics_extra.csv sea valida.

Segunda pregunta (la que si dio resultado)
------------------------------------------
El AR1 predice la semana t con los casos de t-1, o sea da 1 sola semana de aviso.
Para desplegar brigadas eso es poco. ¿Hasta que horizonte h aguanta la deteccion?
Se reajusta el mismo GLM-NB usando casos(t-h) y se mide AUC/recall sobre las
semanas altas del test. Esto usa el dataset original (2021-2023), no el extendido.

Salidas: results/test_historia_extendida.csv
         results/test_horizonte_aviso.csv
         results/figures/14_historia_extendida_mae_recall.png
         results/figures/15_horizonte_aviso.png
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import xgboost as xgb

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_experiments import RES, FIG, design, fit_glm, predict_mu, metrics, savefig

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FEATS = ["ar1_nac", "ar2_nac", "precipitacion_mm", "precip_30d",
         "tmin", "tmax", "humedad", "spi6", "semana"]


def build_extended():
    """Serie nacional 2015-2023 + clima, SIN variables de corte (no existen antes de 2021)."""
    den = pd.read_csv(os.path.join(ROOT, "data", "raw",
                                   "dengue_ecuador_nacional_semanal_opendengue.csv"))
    cli = pd.read_csv(os.path.join(ROOT, "data", "clean", "clima_guayaquil_semanal.csv"))
    pob = pd.read_csv(os.path.join(ROOT, "data", "raw", "poblacion_guayaquil_anual.csv"))

    den = den.rename(columns={"casos": "casos_dengue_nacional"})
    d = den.merge(
        cli[["semana_id", "precipitacion_mm", "precip_30d", "tmin", "tmax", "humedad", "spi6"]],
        on="semana_id", how="left",
    )

    # 2020: 1 sola semana en OpenDengue (colapso de vigilancia COVID). Se excluye.
    n_2020 = int((d["anio_epi"] == 2020).sum())
    d = d[d["anio_epi"] != 2020].copy()

    # Poblacion: observada 2021+, retropolada hacia atras con la tasa media anual.
    pob = pob[["anio", "poblacion_guayaquil"]].sort_values("anio")
    tasa = (pob["poblacion_guayaquil"].iloc[-1] / pob["poblacion_guayaquil"].iloc[0]) ** (
        1 / (pob["anio"].iloc[-1] - pob["anio"].iloc[0])
    )
    base_anio, base_pob = int(pob["anio"].iloc[0]), float(pob["poblacion_guayaquil"].iloc[0])
    mapa = dict(zip(pob["anio"], pob["poblacion_guayaquil"].astype(float)))
    d["poblacion"] = [
        mapa.get(a, base_pob * (tasa ** (a - base_anio))) for a in d["anio_epi"]
    ]
    d["poblacion_es_retropolada"] = ~d["anio_epi"].isin(mapa.keys())

    d["fecha_lunes"] = pd.to_datetime(d["fecha_inicio"])
    d = d.sort_values("fecha_lunes").reset_index(drop=True)

    # ar1/ar2 solo cuando la semana previa es realmente contigua (corta en el hueco 2020)
    dif = d["fecha_lunes"].diff().dt.days
    d["ar1_nac"] = d["casos_dengue_nacional"].shift(1).where(dif == 7)
    d["ar2_nac"] = d["casos_dengue_nacional"].shift(2).where(
        (dif == 7) & (dif.shift(1) == 7)
    )
    return d, n_2020


def eval_xgb(d, tr, te, tag):
    model = xgb.XGBRegressor(
        n_estimators=300, max_depth=3, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=1.0,
        objective="count:poisson", random_state=42,
    )
    y = d["casos_dengue_nacional"].astype(float)
    model.fit(d.loc[tr, FEATS], y[tr])
    mu = model.predict(d.loc[te, FEATS])
    m = metrics(y[te].values, mu, tag, n_params=len(FEATS))
    m["N_train"] = int(tr.sum())
    m["max_train_casos"] = float(y[tr].max())
    m["max_pred"] = float(mu.max())
    return m, np.asarray(mu)


def eval_ar1(d, tr, te, tag):
    # with_year=False a proposito: design() crea una dummy por anio, y la dummy del
    # anio de test siempre vale 0 en train, asi que su coeficiente no esta
    # identificado. Con 2 anios de historia el efecto pasa desapercibido; con 9 el
    # modelo explota (MAE ~16000). Un efecto de anio no es extrapolable a un anio
    # futuro por definicion, asi que para pronostico no corresponde incluirlo.
    X, y, pop, ok, _ = design(d, "casos_dengue_nacional", [("ar1_nac", False, 0)],
                              maxlag=0, with_harmonics=False, with_year=False)
    trd, ted = ok & tr.values, ok & te.values
    res, _, _ = fit_glm(X[trd], y[trd], pop[trd], "nb")
    mu = predict_mu(res, X[ted], pop[ted])
    m = metrics(y[ted], mu, tag, n_params=int(res.df_model) + 1)
    m["N_train"] = int(trd.sum())
    m["max_train_casos"] = float(y[trd].max())
    m["max_pred"] = float(mu.max())
    return m, np.asarray(mu)


def run_horizonte(horizontes=(1, 2, 4, 6, 8, 12)):
    """¿Cuanta anticipacion aguanta el aviso? Reajusta el GLM-NB con casos(t-h)
    y mide deteccion de semanas altas, no error de magnitud."""
    from sklearn.metrics import roc_auc_score
    from run_experiments import DATA

    df = pd.read_csv(DATA)
    df["fecha_lunes"] = pd.to_datetime(df["fecha_lunes"])
    df = df.sort_values("fecha_lunes").reset_index(drop=True)
    nat = df["casos_dengue_nacional"].notna()

    rows = []
    for h in horizontes:
        d = df.copy()
        d["arh"] = d["casos_dengue_nacional"].shift(h)
        tr = nat & (d["anio_epi"] <= 2022) & d["arh"].notna()
        te = nat & (d["anio_epi"] == 2023) & d["arh"].notna()
        X, y, pop, ok, _ = design(d, "casos_dengue_nacional", [("arh", False, 0)],
                                  maxlag=0, with_harmonics=False, with_year=False)
        trd, ted = ok & tr.values, ok & te.values
        res, _, _ = fit_glm(X[trd], y[trd], pop[trd], "nb")
        mu = predict_mu(res, X[ted], pop[ted])
        yt = y[ted]
        thr = np.quantile(yt, 0.75)
        lab, pred = (yt >= thr).astype(int), (mu >= thr).astype(int)
        tp = int(((lab == 1) & (pred == 1)).sum())
        fp = int(((lab == 0) & (pred == 1)).sum())
        fn = int(((lab == 1) & (pred == 0)).sum())
        rows.append(dict(
            horizonte_semanas=h, N_train=int(trd.sum()), N_test=int(ted.sum()),
            MAE=float(np.mean(np.abs(yt - mu))), AUC_alto=float(roc_auc_score(lab, mu)),
            recall_alto=tp / (tp + fn) if (tp + fn) else np.nan,
            precision_alto=tp / (tp + fp) if (tp + fp) else np.nan,
            semanas_altas_reales=int(lab.sum()), umbral_p75=float(thr),
        ))
    out = pd.DataFrame(rows)
    out.to_csv(os.path.join(RES, "test_horizonte_aviso.csv"), index=False)

    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.plot(out["horizonte_semanas"], out["AUC_alto"], marker="o", color="#1d4ed8", label="AUC")
    ax.plot(out["horizonte_semanas"], out["recall_alto"], marker="s", color="#b45309",
            label="recall semanas altas")
    ax.axhline(0.5, color="#999", lw=0.8, ls="--")
    ax.set_xlabel("semanas de anticipacion del aviso")
    ax.set_ylim(0, 1)
    ax.set_title("¿Cuanta anticipacion aguanta el aviso? (test 2023)")
    ax.legend(fontsize=8)
    savefig(os.path.join(FIG, "15_horizonte_aviso.png"))
    return out


def main():
    d, n_2020 = build_extended()
    print(f"Serie extendida: {d['semana_id'].min()} -> {d['semana_id'].max()}  ({len(d)} semanas)")
    print(f"  2020 excluido ({n_2020} semana(s) en OpenDengue, colapso COVID)")
    print(f"  poblacion retropolada en {int(d['poblacion_es_retropolada'].sum())} semanas")

    y = d["casos_dengue_nacional"].astype(float)
    ok = y.notna() & d[FEATS].notna().all(axis=1)
    test = ok & (d["anio_epi"] == 2023)

    # Mismo test (2023), dos tamanos de entrenamiento
    escenarios = {
        "corto_2021_2022": ok & d["anio_epi"].between(2021, 2022),
        "largo_2015_2022": ok & (d["anio_epi"] <= 2022),
    }

    rows, curvas = [], {}
    for nombre, tr in escenarios.items():
        for fn, fam in ((eval_ar1, "AR1"), (eval_xgb, "XGB")):
            m, mu = fn(d, tr, test, f"{fam}|{nombre}")
            m["escenario"] = nombre
            m["familia_modelo"] = fam
            rows.append(m)
            curvas[f"{fam}|{nombre}"] = mu

    y_te = y[test].values
    thr = float(np.quantile(y_te, 0.75))
    out = pd.DataFrame(rows)
    out["umbral_alto_p75_test"] = thr
    out["semanas_altas_reales"] = int((y_te >= thr).sum())
    cols = ["modelo", "N_train", "max_train_casos", "max_pred", "MAE", "RMSE",
            "AUC_alto", "recall_alto", "precision_alto", "F1_alto"]
    print(f"\nUmbral 'semana alta' = p75 del test 2023 = {thr:.0f} casos "
          f"({int((y_te >= thr).sum())} de {len(y_te)} semanas)")
    print(out[cols].to_string(index=False))

    out.to_csv(os.path.join(RES, "test_historia_extendida.csv"), index=False)

    fig, (a1, a2) = plt.subplots(1, 2, figsize=(11, 3.8))
    orden = out["modelo"].tolist()
    a1.barh(orden, out["MAE"], color="#334155")
    a1.invert_yaxis()
    a1.set_xlabel("MAE (test 2023) — menor es mejor")
    a1.set_title("Error de magnitud")
    a2.barh(orden, out["recall_alto"], color="#b45309")
    a2.invert_yaxis()
    a2.set_xlim(0, 1)
    a2.set_xlabel("recall de semanas altas — mayor es mejor")
    a2.set_title("Deteccion de semanas de brote")
    savefig(os.path.join(FIG, "14_historia_extendida_mae_recall.png"))
    print(f"\nEscrito: {os.path.join(RES, 'test_historia_extendida.csv')}")

    print("\n=== Horizonte del aviso (dataset original 2021-2023) ===")
    hz = run_horizonte()
    print(hz[["horizonte_semanas", "MAE", "AUC_alto", "recall_alto",
              "precision_alto"]].round(3).to_string(index=False))
    print(f"\nEscrito: {os.path.join(RES, 'test_horizonte_aviso.csv')}")


if __name__ == "__main__":
    main()
