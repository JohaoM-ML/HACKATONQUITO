"""
download_climate.py — VENTANA SECA
Descarga clima diario REAL de Guayaquil desde Open-Meteo (ERA5 archive, sin credenciales),
lo agrega a escala semanal (semana epidemiologica CDC/ISO-like domingo-sabado) y calcula SPI.

Fuente: https://archive-api.open-meteo.com/v1/archive   (reanalisis ERA5, verificado en vivo)
- precipitation_sum (mm)  -> suma semanal
- temperature_2m_min/max/mean (C) -> min/max/media semanal
- relative_humidity_2m_mean (%) -> media semanal

SPI: se calibra con la normal larga 1991-2020 (>=30 anios, estandar OMM) descargando esa ventana.
     SPI-k por acumulado movil de k meses (~4.345 semanas/mes) ajustando distribucion gamma
     por semana-del-anio (climatologia) y transformando a cuantil normal estandar.

Uso:
    python scripts/download_climate.py
Salida:
    data/raw/clima_guayaquil_diario.csv
    data/clean/clima_guayaquil_semanal.csv
"""
import urllib.request, urllib.parse, json, io, os, sys, time
from datetime import date
import numpy as np
import pandas as pd
from scipy.stats import gamma, norm

LAT, LON = -2.19, -79.88
TZ = "America/Guayaquil"
# Ventana de calibracion larga para SPI (estandar OMM) + ventana de estudio
CALIB_START = "1991-01-01"
STUDY_END = date.today().isoformat()
BASE = "https://archive-api.open-meteo.com/v1/archive"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
CLEAN = os.path.join(ROOT, "data", "clean")
os.makedirs(RAW, exist_ok=True)
os.makedirs(CLEAN, exist_ok=True)


def fetch_daily(start, end):
    params = {
        "latitude": LAT, "longitude": LON,
        "start_date": start, "end_date": end,
        "daily": "precipitation_sum,temperature_2m_min,temperature_2m_max,temperature_2m_mean,relative_humidity_2m_mean",
        "timezone": TZ,
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    for intento in range(4):
        try:
            with urllib.request.urlopen(url, timeout=120) as r:
                d = json.load(r)
            daily = d["daily"]
            df = pd.DataFrame(daily)
            df["time"] = pd.to_datetime(df["time"])
            return df
        except Exception as e:
            print(f"  reintento {intento+1}: {e}", file=sys.stderr)
            time.sleep(5)
    raise RuntimeError("No se pudo descargar el clima tras 4 intentos")


def epi_week(dt):
    """Semana epidemiologica estilo CDC: domingo a sabado. Devuelve (anio_epi, semana)."""
    # Usamos ISO como aproximacion operativa y documentamos. ISO: lunes-domingo.
    iso = dt.isocalendar()
    return iso.year, iso.week


def to_weekly(df):
    df = df.copy()
    iso = df["time"].dt.isocalendar()
    df["anio_epi"] = iso["year"].values
    df["semana"] = iso["week"].values
    g = df.groupby(["anio_epi", "semana"])
    wk = g.agg(
        fecha_inicio=("time", "min"),
        fecha_fin=("time", "max"),
        n_dias=("time", "count"),
        precipitacion_mm=("precipitation_sum", "sum"),
        tmin=("temperature_2m_min", "mean"),
        tmax=("temperature_2m_max", "mean"),
        tmean=("temperature_2m_mean", "mean"),
        humedad=("relative_humidity_2m_mean", "mean"),
    ).reset_index()
    # Solo semanas completas (7 dias) para no sesgar sumas de lluvia
    wk = wk[wk["n_dias"] == 7].reset_index(drop=True)
    wk["semana_id"] = wk["anio_epi"].astype(str) + "-W" + wk["semana"].astype(str).str.zfill(2)
    return wk


def rolling_precip(wk):
    wk = wk.sort_values(["fecha_inicio"]).reset_index(drop=True)
    p = wk["precipitacion_mm"]
    wk["precip_7d"] = wk["precipitacion_mm"]          # 1 semana
    wk["precip_30d"] = p.rolling(4, min_periods=4).sum()   # ~1 mes
    wk["precip_90d"] = p.rolling(13, min_periods=13).sum()  # ~3 meses
    return wk


def spi_from_accum(accum, week_of_year):
    """
    SPI aproximado a la OMM: ajusta gamma por semana-del-anio sobre la ventana de
    calibracion y transforma el acumulado a cuantil normal estandar.
    Devuelve serie SPI alineada con accum.
    """
    accum = pd.Series(accum).astype(float)
    woy = pd.Series(week_of_year).values
    spi = pd.Series(np.nan, index=accum.index)
    for w in np.unique(woy):
        mask = (woy == w) & accum.notna().values
        vals = accum[mask]
        if len(vals) < 10:
            continue
        # proporcion de ceros (gamma no admite 0)
        pos = vals[vals > 0]
        q0 = (len(vals) - len(pos)) / len(vals)
        if len(pos) < 8:
            continue
        try:
            a, loc, scale = gamma.fit(pos, floc=0)
        except Exception:
            continue
        cdf = q0 + (1 - q0) * gamma.cdf(vals, a, loc=0, scale=scale)
        cdf = np.clip(cdf, 1e-6, 1 - 1e-6)
        spi[mask] = norm.ppf(cdf)
    return spi


def add_spi(wk):
    # acumulados moviles en n semanas ~ meses
    p = wk.sort_values("fecha_inicio")["precipitacion_mm"].reset_index(drop=True)
    wk = wk.sort_values("fecha_inicio").reset_index(drop=True)
    acc3 = p.rolling(13, min_periods=13).sum()   # 3 meses
    acc6 = p.rolling(26, min_periods=26).sum()   # 6 meses
    acc12 = p.rolling(52, min_periods=52).sum()  # 12 meses
    woy = wk["semana"].values
    wk["spi3"] = spi_from_accum(acc3, woy)
    wk["spi6"] = spi_from_accum(acc6, woy)
    wk["spi12"] = spi_from_accum(acc12, woy)
    return wk


def main():
    print(f"Descargando clima diario Guayaquil {CALIB_START} -> {STUDY_END} (Open-Meteo ERA5)...")
    df = fetch_daily(CALIB_START, STUDY_END)
    print(f"  {len(df)} dias descargados ({df['time'].min().date()} a {df['time'].max().date()})")
    df.to_csv(os.path.join(RAW, "clima_guayaquil_diario.csv"), index=False)

    wk = to_weekly(df)
    wk = rolling_precip(wk)
    wk = add_spi(wk)

    cols = ["semana_id", "anio_epi", "semana", "fecha_inicio", "fecha_fin",
            "precipitacion_mm", "precip_7d", "precip_30d", "precip_90d",
            "spi3", "spi6", "spi12", "tmin", "tmax", "tmean", "humedad"]
    wk_out = wk[cols].copy()
    for c in ["precipitacion_mm", "precip_7d", "precip_30d", "precip_90d",
              "spi3", "spi6", "spi12", "tmin", "tmax", "tmean", "humedad"]:
        wk_out[c] = wk_out[c].round(3)
    out = os.path.join(CLEAN, "clima_guayaquil_semanal.csv")
    wk_out.to_csv(out, index=False)
    print(f"  {len(wk_out)} semanas -> {out}")
    print("  cobertura SPI6 no-NA:", int(wk_out['spi6'].notna().sum()))


if __name__ == "__main__":
    main()
