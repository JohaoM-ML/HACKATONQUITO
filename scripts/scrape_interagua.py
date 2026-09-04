"""
scrape_interagua.py — VENTANA SECA
Andamiaje REPRODUCIBLE para ampliar automaticamente el CSV de cortes de Interagua.

CONTEXTO (verificado por investigacion):
  - La web oficial https://www.interagua.com.ec/interrupciones-de-servicio ES la fuente primaria
    (archivo desde ~2023, listado paginado /node?page=N) PERO bloquea/timeoutea fetchers simples
    (WAF/anti-bot). Requiere navegador headless (Playwright/Selenium) con user-agent realista.
  - Los sectores a veces vienen como IMAGEN (X/Twitter) -> requiere OCR.
  - La hemeroteca de El Universo es la mas consistente y reproduce listas completas de calles.

ESTRATEGIA (3 capas):
  1. Intento HTTP directo con headers de navegador (a veces pasa).
  2. Si falla -> Wayback CDX API (snapshots ya cacheados de la web oficial).
  3. Complemento -> busqueda en hemerotecas (manual/semiautomatica).

Este script implementa la capa 2 (Wayback CDX), que SI es accesible por HTTP simple,
para listar snapshots historicos de la pagina de interrupciones y poder parsearlos luego.

Uso:
    python scripts/scrape_interagua.py
Salida:
    data/raw/interagua_wayback_snapshots.csv   (indice de snapshots historicos)
"""
import os, json, urllib.request, urllib.parse
import pandas as pd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW, exist_ok=True)

TARGETS = [
    "interagua.com.ec/interrupciones-de-servicio",
    "interagua.com.ec/interrupciones*",
    "interagua.com.ec/node*",
]
CDX = "http://web.archive.org/cdx/search/cdx"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                         "(KHTML, like Gecko) Chrome/120 Safari/537.36"}


def cdx_snapshots(url_pattern):
    params = {"url": url_pattern, "output": "json", "collapse": "digest",
              "fl": "timestamp,original,statuscode", "from": "2021", "to": "2026"}
    q = CDX + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(q, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.load(r)
    if not data:
        return []
    header, *rows = data
    return [dict(zip(header, row)) for row in rows]


def main():
    allrows = []
    for pat in TARGETS:
        try:
            snaps = cdx_snapshots(pat)
            print(f"{pat}: {len(snaps)} snapshots")
            for s in snaps:
                s["pattern"] = pat
                s["wayback_url"] = f"https://web.archive.org/web/{s['timestamp']}/{s['original']}"
            allrows.extend(snaps)
        except Exception as e:
            print(f"{pat}: ERROR {e}")
    if allrows:
        df = pd.DataFrame(allrows).drop_duplicates(subset=["wayback_url"])
        out = os.path.join(RAW, "interagua_wayback_snapshots.csv")
        df.to_csv(out, index=False)
        print(f"{len(df)} snapshots -> {out}")
        print("SIGUIENTE PASO: parsear cada wayback_url (HTML) para extraer fecha/sectores/horas")
    else:
        print("No se obtuvieron snapshots (Wayback pudo no indexar el dominio).")


if __name__ == "__main__":
    main()
