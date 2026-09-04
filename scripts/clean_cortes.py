"""
clean_cortes.py — VENTANA SECA
Limpia data/raw/cortes_interagua_raw.csv -> data/clean/cortes_interagua_clean.csv

Normaliza:
- fechas a datetime (valida fecha_fin >= fecha_inicio)
- duracion_horas: texto ("12", "4-10", "11-16", "NA") -> duracion_horas_num (float, punto medio de rangos) + flag
- pidio_almacenar -> almacenar (1/0/NA)
- deriva anio, semana ISO de fecha_inicio
- cuenta sectores del campo sectores_ejemplo (separados por ;)

NO inventa datos. Los NA se conservan como NA.
"""
import os
import numpy as np
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw", "cortes_interagua_raw.csv")
OUT = os.path.join(ROOT, "data", "clean", "cortes_interagua_clean.csv")


def parse_duracion(x):
    """'12'->12, '4-10'->7.0 (punto medio), '11-16'->13.5, 'NA'->NaN. Devuelve (num, es_rango, incompleta)."""
    if pd.isna(x) or str(x).strip().upper() == "NA":
        return np.nan, 0, 1
    s = str(x).strip().replace(",", ".")
    if "-" in s:
        try:
            a, b = s.split("-")
            return (float(a) + float(b)) / 2.0, 1, 0
        except Exception:
            return np.nan, 0, 1
    try:
        return float(s), 0, 0
    except Exception:
        return np.nan, 0, 1


def main():
    df = pd.read_csv(RAW, dtype=str)
    df["fecha_inicio"] = pd.to_datetime(df["fecha_inicio"], errors="coerce")
    df["fecha_fin"] = pd.to_datetime(df["fecha_fin"], errors="coerce")

    # validacion: fin >= inicio
    bad = df["fecha_fin"] < df["fecha_inicio"]
    if bad.any():
        print("ADVERTENCIA: filas con fecha_fin < fecha_inicio:", int(bad.sum()))
    df = df[~bad | df["fecha_fin"].isna()].copy()

    parsed = df["duracion_horas"].apply(parse_duracion)
    df["duracion_horas_num"] = [p[0] for p in parsed]
    df["duracion_es_rango"] = [p[1] for p in parsed]
    df["duracion_incompleta"] = [p[2] for p in parsed]

    m = {"si": 1, "no": 0}
    df["almacenar"] = df["pidio_almacenar"].str.strip().str.lower().map(m)

    df["anio"] = df["fecha_inicio"].dt.year
    iso = df["fecha_inicio"].dt.isocalendar()
    df["semana"] = iso["week"].values
    df["anio_epi"] = iso["year"].values
    df["semana_id"] = df["anio_epi"].astype("Int64").astype(str) + "-W" + df["semana"].astype("Int64").astype(str).str.zfill(2)

    df["n_sectores_listados"] = df["sectores_ejemplo"].fillna("").apply(
        lambda s: 0 if not s.strip() else len([x for x in s.split(";") if x.strip()])
    )

    cols = ["fecha_inicio", "fecha_fin", "anio", "anio_epi", "semana", "semana_id",
            "duracion_horas", "duracion_horas_num", "duracion_es_rango", "duracion_incompleta",
            "zona_ciudad", "sectores_ejemplo", "n_sectores_listados", "motivo", "tipo_corte",
            "pidio_almacenar", "almacenar", "fuente", "url", "confianza"]
    out = df[cols].sort_values("fecha_inicio").reset_index(drop=True)
    out.to_csv(OUT, index=False)
    print(f"{len(out)} cortes limpios -> {OUT}")
    print("Por anio:")
    print(out.groupby("anio").size().to_string())


if __name__ == "__main__":
    main()
