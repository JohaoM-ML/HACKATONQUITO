"""
build_dataset.py — VENTANA SECA
Integra todo en la serie semanal continua Guayaquil x semana:
    data/model/ventana_seca_guayaquil_weekly.csv

Entradas (deben existir):
    data/clean/cortes_interagua_clean.csv     (clean_cortes.py)
    data/clean/clima_guayaquil_semanal.csv    (download_climate.py)
    data/raw/poblacion_guayaquil_anual.csv

REGLA DE AGREGACION DE CORTES (evento -> semana), documentada y reproducible:
  Un corte se asigna a la semana ISO de su FECHA_INICIO.
  - n_eventos_corte = numero de cortes iniciados en esa semana
  - corte_hn        = 1 si n_eventos_corte >= 1, si no 0  (semana CON evento verificado)
  - horas_corte     = suma de duracion_horas_num de esos cortes (rango -> punto medio);
                      los cortes con duracion NA NO suman horas pero SI cuentan como evento
  - horas_corte_incompleta = 1 si algun corte de la semana tenia duracion NA
  - almacenar       = 1 si algun corte de la semana pidio almacenar agua
  - n_sectores      = suma de sectores listados (subestimacion: es "ejemplo", no total)

CONTINUIDAD: calendario semanal ISO continuo desde 2021-W01 hasta la ultima semana
completa de clima. NO se rellenan valores faltantes con 0:
  - casos_dengue      -> NA  (no hay serie semanal publica limpia Guayas/Guayaquil; ver informe)
  - corte_hn/n_eventos-> 0 SOLO significa "sin corte PROGRAMADO/emergente reportado en prensa"
                         esa semana; es un 0 de reporte, no necesariamente ausencia real.
                         Se marca corte_reporte_confiable segun densidad de cobertura del anio.
"""
import os
import numpy as np
import pandas as pd
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLEAN = os.path.join(ROOT, "data", "clean")
RAW = os.path.join(ROOT, "data", "raw")
MODEL = os.path.join(ROOT, "data", "model")
os.makedirs(MODEL, exist_ok=True)

STUDY_START_YEAR = 2021


def iso_week_calendar(start_year, end_date):
    """Genera semanas ISO continuas desde start_year-W01 hasta la semana que contiene end_date."""
    rows = []
    d = date(start_year, 1, 4)  # 4-ene siempre esta en W01 ISO
    d = d - pd.Timedelta(days=d.isoweekday() - 1)  # lunes de W01
    d = pd.Timestamp(d)
    end = pd.Timestamp(end_date)
    while d <= end:
        iso = d.isocalendar()
        rows.append({
            "semana_id": f"{iso.year}-W{str(iso.week).zfill(2)}",
            "anio_epi": iso.year,
            "semana": iso.week,
            "fecha_lunes": d,
            "fecha_inicio": d,
            "fecha_fin": d + pd.Timedelta(days=6),
        })
        d = d + pd.Timedelta(days=7)
    return pd.DataFrame(rows)


def main():
    cortes = pd.read_csv(os.path.join(CLEAN, "cortes_interagua_clean.csv"))
    clima = pd.read_csv(os.path.join(CLEAN, "clima_guayaquil_semanal.csv"))
    pobla = pd.read_csv(os.path.join(RAW, "poblacion_guayaquil_anual.csv"))
    pobla = pobla[pobla["tipo"] == "proyeccion_rev2024"][["anio", "poblacion_guayaquil"]]

    end_date = pd.to_datetime(clima["fecha_fin"]).max()
    cal = iso_week_calendar(STUDY_START_YEAR, end_date)

    # --- agregacion de cortes por semana ISO de inicio ---
    g = cortes.groupby("semana_id")
    agg = g.agg(
        n_eventos_corte=("fecha_inicio", "count"),
        horas_corte=("duracion_horas_num", "sum"),
        horas_corte_incompleta=("duracion_incompleta", "max"),
        almacenar=("almacenar", "max"),
        n_sectores=("n_sectores_listados", "sum"),
    ).reset_index()
    df = cal.merge(agg, on="semana_id", how="left")
    df["n_eventos_corte"] = df["n_eventos_corte"].fillna(0).astype(int)
    df["corte_hn"] = (df["n_eventos_corte"] >= 1).astype(int)
    # semanas sin evento: horas 0, almacenar 0 (0 de REPORTE, documentado)
    df["horas_corte"] = df["horas_corte"].where(df["n_eventos_corte"] > 0, 0.0)
    df["almacenar"] = df["almacenar"].fillna(0).astype(int)
    df["horas_corte_incompleta"] = df["horas_corte_incompleta"].fillna(0).astype(int)
    df["n_sectores"] = df["n_sectores"].fillna(0).astype(int)
    # intensidad_corte: horas x sectores listados. JUSTIFICACION: combina duracion y
    # alcance reportado. LIMITACION: n_sectores es una lista de ejemplo, no el total.
    df["intensidad_corte"] = df["horas_corte"].fillna(0) * df["n_sectores"].clip(lower=0)

    # --- clima ---
    clima_cols = ["semana_id", "precipitacion_mm", "precip_7d", "precip_30d", "precip_90d",
                  "spi3", "spi6", "spi12", "tmin", "tmax", "tmean", "humedad"]
    df = df.merge(clima[clima_cols], on="semana_id", how="left")

    # --- poblacion (por anio calendario del lunes de la semana) ---
    df["anio_cal"] = df["fecha_lunes"].dt.year
    df = df.merge(pobla, left_on="anio_cal", right_on="anio", how="left")
    df.rename(columns={"poblacion_guayaquil": "poblacion"}, inplace=True)
    df.drop(columns=["anio"], inplace=True)

    # --- casos dengue GUAYAS/GUAYAQUIL: NO disponible semanal limpio -> NA ---
    # (requiere digitalizar el grafico de la Gaceta ETV del MSP; ver scrape_dengue_msp.py)
    df["casos_dengue"] = np.nan
    df["casos_unidad"] = "NA"

    # --- casos dengue NACIONAL semanal (OpenDengue / PAHO): SI disponible 2015-2023 ---
    # Escala NACIONAL, no Guayas. Sirve para validar la estructura de rezago del DLNM a
    # escala pais. Confianza A (dataset cientifico revisado).
    od_path = os.path.join(RAW, "dengue_ecuador_nacional_semanal_opendengue.csv")
    if os.path.exists(od_path):
        od = pd.read_csv(od_path)[["semana_id", "casos"]].rename(
            columns={"casos": "casos_dengue_nacional"})
        df = df.merge(od, on="semana_id", how="left")
    else:
        df["casos_dengue_nacional"] = np.nan

    # --- confiabilidad del reporte de cortes por anio (densidad de cobertura hallada) ---
    dens = {2021: "baja", 2022: "baja", 2023: "alta", 2024: "alta", 2025: "alta", 2026: "media"}
    df["corte_reporte_confiable"] = df["anio_cal"].map(dens).fillna("baja")

    out_cols = ["semana_id", "anio_epi", "semana", "fecha_lunes", "fecha_inicio", "fecha_fin",
                "casos_dengue", "casos_unidad", "casos_dengue_nacional", "poblacion",
                "corte_hn", "n_eventos_corte", "horas_corte", "intensidad_corte",
                "horas_corte_incompleta", "almacenar", "n_sectores", "corte_reporte_confiable",
                "precipitacion_mm", "precip_7d", "precip_30d", "precip_90d",
                "spi3", "spi6", "spi12", "tmin", "tmax", "tmean", "humedad"]
    out = df[out_cols].sort_values("fecha_lunes").reset_index(drop=True)
    out.to_csv(os.path.join(MODEL, "ventana_seca_guayaquil_weekly.csv"), index=False)

    # --- reporte de viabilidad ---
    n = len(out)
    con_clima = int(out["tmin"].notna().sum())
    con_spi6 = int(out["spi6"].notna().sum())
    con_corte = int((out["corte_hn"] == 1).sum())
    con_casos = int(out["casos_dengue"].notna().sum())
    con_casos_nac = int(out["casos_dengue_nacional"].notna().sum())
    # semanas con TODO lo necesario para DLNM nacional: casos_nac + corte + precip + temp
    completo = int((out["casos_dengue_nacional"].notna() & out["tmin"].notna() &
                    out["precipitacion_mm"].notna()).sum())
    print(f"Dataset -> data/model/ventana_seca_guayaquil_weekly.csv")
    print(f"  semanas totales (2021-W01 .. {out['semana_id'].iloc[-1]}): {n}")
    print(f"  semanas con clima (tmin no-NA): {con_clima}  ({100*con_clima/n:.0f}%)")
    print(f"  semanas con SPI6: {con_spi6}")
    print(f"  semanas con corte reportado (corte_hn=1): {con_corte}")
    print(f"  semanas con casos_dengue GUAYAS/local: {con_casos}  <-- GAP CRITICO")
    print(f"  semanas con casos_dengue NACIONAL: {con_casos_nac}")
    print(f"  semanas con [casos_nac + corte-col + precip + temp]: {completo}")
    print(f"  eventos de corte cargados: {int(out['n_eventos_corte'].sum())}")


if __name__ == "__main__":
    main()
