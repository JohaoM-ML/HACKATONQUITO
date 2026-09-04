"""
download_dengue_opendengue.py — VENTANA SECA
Descarga la serie semanal NACIONAL de dengue de Ecuador desde OpenDengue (dataset cientifico,
fuente PAHO), la unica serie SEMANAL publica y limpia disponible.

IMPORTANTE (honestidad):
  - Resolucion espacial = NACIONAL (Ecuador), NO Guayas ni Guayaquil.
  - Cobertura semanal tipica en OpenDengue National extract: ~2022-2024 (verificar en salida).
  - Sirve como Y proxy a escala pais para VALIDAR la estructura de rezago del DLNM,
    NO como objetivo por barrio. La serie Guayas-semanal 2021-2026 sigue requiriendo
    digitalizar el grafico de las Gacetas ETV del MSP (ver scrape_dengue_msp.py).

Fuente: https://opendengue.org  (National_extract_V1_3.csv)
Paper: https://doi.org/10.1038/s41597-024-03120-7

Salida: data/raw/dengue_ecuador_nacional_semanal_opendengue.csv
"""
import os, io, zipfile, urllib.request
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW, exist_ok=True)
URL = "https://github.com/OpenDengue/master-repo/raw/main/data/releases/V1.3/National_extract_V1_3.zip"


def main():
    print("Descargando OpenDengue National_extract_V1_3 ...")
    data = urllib.request.urlopen(URL, timeout=120).read()
    z = zipfile.ZipFile(io.BytesIO(data))
    name = z.namelist()[0]
    df = pd.read_csv(z.open(name))
    print("columnas:", list(df.columns))

    # Filtrar Ecuador (columnas conocidas del National_extract_V1_3)
    ecu = df[df["adm_0_name"].str.contains("Ecuador", case=False, na=False)].copy()
    print("filas Ecuador:", len(ecu))
    if "T_res" in ecu.columns:
        print("resoluciones temporales:", ecu["T_res"].value_counts().to_dict())

    ecu = ecu.rename(columns={
        "calendar_start_date": "fecha_inicio",
        "calendar_end_date": "fecha_fin",
        "dengue_total": "casos",
    })
    ecu["fecha_inicio"] = pd.to_datetime(ecu["fecha_inicio"], errors="coerce")
    ecu["fecha_fin"] = pd.to_datetime(ecu["fecha_fin"], errors="coerce")
    ecu["dur_dias"] = (ecu["fecha_fin"] - ecu["fecha_inicio"]).dt.days + 1

    # Quedarnos con resolucion semanal (~7 dias)
    wk = ecu[(ecu["dur_dias"] >= 6) & (ecu["dur_dias"] <= 8)].copy()
    iso = wk["fecha_inicio"].dt.isocalendar()
    wk["anio_epi"] = iso["year"].values
    wk["semana"] = iso["week"].values
    wk["semana_id"] = wk["anio_epi"].astype(str) + "-W" + wk["semana"].astype(str).str.zfill(2)
    wk = wk[["semana_id", "anio_epi", "semana", "fecha_inicio", "fecha_fin", "casos"]].sort_values("fecha_inicio")

    out = os.path.join(RAW, "dengue_ecuador_nacional_semanal_opendengue.csv")
    wk.to_csv(out, index=False)
    print(f"{len(wk)} semanas nacionales -> {out}")
    if len(wk):
        print("rango:", wk["semana_id"].iloc[0], "->", wk["semana_id"].iloc[-1])


if __name__ == "__main__":
    main()
