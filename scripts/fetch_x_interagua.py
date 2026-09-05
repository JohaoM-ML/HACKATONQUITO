"""
fetch_x_interagua.py — VENTANA SECA
Descarga el timeline de la cuenta oficial de Interagua desde la API de X (v2)
para ampliar data/raw/cortes_interagua_raw.csv con la fuente primaria.

POR QUE ESTE ENDPOINT Y NO BUSQUEDA
  El plan de pago por uso ($0.005 / post leido) NO incluye full-archive search.
  - search/recent  -> solo 7 dias. Inservible para historico.
  - search/all     -> Enterprise (~$42k/mes). Fuera de alcance.
  - users/:id/tweets -> los 3200 posts mas recientes, SIN limite de fecha. <-- unica via.
  El tope de 3200 es por CANTIDAD, no por antiguedad: hasta que fecha llegas
  depende del ritmo de publicacion de la cuenta. Por eso existe el modo --sondeo.

  OJO: usar exclude=replies BAJA el tope de 3200 a 800. Por eso bajamos todo
  (respuestas incluidas) y filtramos en local, aunque se pague por posts que no se usan.

LIMITACION CONOCIDA (no resuelta aqui)
  Interagua publica sectores y horarios frecuentemente COMO IMAGEN. La API entrega
  la URL del media, no el texto interno. Esos posts quedan con duracion_horas = NA
  y el campo media_urls poblado, para pasarlos luego por OCR. No se inventa la hora.

USO
  set X_BEARER_TOKEN=...                      (Windows CMD)
  $env:X_BEARER_TOKEN="..."                   (PowerShell)

  python scripts/fetch_x_interagua.py --sondeo
      Cuesta ~$0.01. NO baja posts. Estima a que fecha llegan 3200 posts.

  python scripts/fetch_x_interagua.py --bajar --max 3200
      Baja el timeline paginando de 100 en 100 y guarda crudo + parseado.
      Costo estimado: n_posts * $0.005.

SALIDAS
  data/raw/x_interagua_timeline.json   crudo completo (para re-parsear sin volver a pagar)
  data/raw/x_interagua_cortes.csv      parseado al esquema de cortes_interagua_raw.csv
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
os.makedirs(RAW, exist_ok=True)

RAW_JSON = os.path.join(RAW, "x_interagua_timeline.json")
OUT_CSV = os.path.join(RAW, "x_interagua_cortes.csv")

API = "https://api.x.com/2"
# CONFIRMAR el handle real antes de gastar: la cuenta oficial puede ser otra.
# Se pasa por --handle para no hardcodear un supuesto.
DEFAULT_HANDLE = "Interagua"

COSTO_LECTURA = 0.005
COSTO_LOOKUP = 0.010
TOPE_TIMELINE = 3200


def token():
    t = os.environ.get("X_BEARER_TOKEN", "").strip()
    if not t:
        sys.exit("Falta X_BEARER_TOKEN en el entorno.")
    return t


def get(path, params):
    r = requests.get(
        API + path,
        params=params,
        headers={"Authorization": "Bearer " + token()},
        timeout=60,
    )
    if r.status_code == 429:
        espera = int(r.headers.get("x-rate-limit-reset", 0)) - int(time.time())
        espera = max(espera, 15)
        print("  429: rate limit. Esperando %ds..." % espera)
        time.sleep(espera + 2)
        return get(path, params)
    if r.status_code != 200:
        sys.exit("HTTP %d en %s: %s" % (r.status_code, path, r.text[:400]))
    return r.json()


def lookup(handle):
    d = get(
        "/users/by/username/" + handle,
        {"user.fields": "created_at,public_metrics,name,description"},
    )
    if "data" not in d:
        sys.exit("Cuenta no encontrada: @%s -> %s" % (handle, json.dumps(d)[:300]))
    return d["data"]


def sondeo(handle):
    """Estima el alcance temporal de 3200 posts. Costo ~$0.01, no baja posts."""
    u = lookup(handle)
    m = u.get("public_metrics", {})
    total = m.get("tweet_count", 0)
    creada = dt.datetime.fromisoformat(u["created_at"].replace("Z", "+00:00"))
    dias = max((dt.datetime.now(dt.timezone.utc) - creada).days, 1)
    ritmo = total / dias

    print("Cuenta      : @%s (%s)" % (u["username"], u.get("name", "")))
    print("Creada      : %s" % creada.date())
    print("Posts total : %d" % total)
    print("Ritmo medio : %.2f posts/dia" % ritmo)
    print("-" * 58)

    if ritmo <= 0:
        print("Sin actividad medible.")
        return
    alcance_dias = TOPE_TIMELINE / ritmo
    fecha = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=alcance_dias)
    n = min(total, TOPE_TIMELINE)
    print("3200 posts cubren ~%.0f dias -> llegarias hasta ~%s" % (alcance_dias, fecha.date()))
    print("Costo de bajar %d posts: $%.2f" % (n, n * COSTO_LECTURA))
    print("-" * 58)
    print("ADVERTENCIA: el ritmo medio es de toda la vida de la cuenta. Si hoy")
    print("tuitean mas que antes, el alcance real sera MENOR que el estimado.")


# --- parseo -----------------------------------------------------------------
# Solo se extrae lo que el texto dice literalmente. Si no aparece, queda NA.

RE_HORAS = re.compile(r"(\d{1,3})\s*horas?\b", re.I)
RE_RANGO = re.compile(r"(?:desde\s*las?\s*)?(\d{1,2})[:h](\d{2})\s*(?:a|hasta|-)\s*(?:las?\s*)?(\d{1,2})[:h](\d{2})", re.I)
RE_FECHA = re.compile(r"\b(\d{1,2})\s*de\s*(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*", re.I)
MESES = {"ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
         "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12}

RE_ALMACENAR = re.compile(r"almacen|reserv[ae]|abastec[ei]|proveerse|guardar\s+agua", re.I)
RE_EMERGENTE = re.compile(r"emergent|fuga|rotura|da[nñ]o|aver[ií]a", re.I)
RE_PROGRAMADO = re.compile(r"programad|mantenimiento|mejora", re.I)

ZONAS = {
    "norte": r"\bnorte\b", "sur": r"\bsur\b", "centro": r"\bcentro\b",
    "via a la costa": r"v[ií]a\s+a\s+la\s+costa", "suburbio": r"\bsuburbio\b",
    "noroeste": r"\bnoroeste\b", "suroeste": r"\bsuroeste\b",
}


def duracion(texto):
    """Devuelve horas como string, o NA. No estima: solo lee lo escrito."""
    m = RE_HORAS.search(texto)
    if m:
        h = int(m.group(1))
        if 1 <= h <= 120:
            return str(h)
    m = RE_RANGO.search(texto)
    if m:
        ini = int(m.group(1)) * 60 + int(m.group(2))
        fin = int(m.group(3)) * 60 + int(m.group(4))
        d = (fin - ini) % (24 * 60)
        if d > 0:
            return str(round(d / 60))
    return "NA"


def zonas(texto):
    z = [k for k, pat in ZONAS.items() if re.search(pat, texto, re.I)]
    return "/".join(z) if z else "NA"


def tipo(texto):
    if RE_EMERGENTE.search(texto):
        return "emergente"
    if RE_PROGRAMADO.search(texto):
        return "programado"
    return "NA"


def es_corte(texto):
    return bool(re.search(r"interrup|suspensi[oó]n|corte|sin\s+agua|sin\s+servicio", texto, re.I))


def parsear(posts, media_por_key):
    filas = []
    for p in posts:
        txt = p.get("text", "")
        if not es_corte(txt):
            continue
        fecha = p["created_at"][:10]
        keys = (p.get("attachments") or {}).get("media_keys", [])
        urls = [media_por_key[k] for k in keys if k in media_por_key]
        filas.append({
            "fecha_post": fecha,
            "fecha_inicio": fecha,          # aproximada: fecha del anuncio, no del corte
            "fecha_fin": "NA",
            "duracion_horas": duracion(txt),
            "zona_ciudad": zonas(txt),
            "sectores_ejemplo": "NA",       # requiere OCR o parseo manual
            "motivo": "NA",
            "tipo_corte": tipo(txt),
            "pidio_almacenar": "si" if RE_ALMACENAR.search(txt) else "NA",
            "fuente": "X/@Interagua",
            "url": "https://x.com/i/status/" + p["id"],
            "confianza": "A",
            "tiene_imagen": "si" if urls else "no",
            "media_urls": ";".join(urls) if urls else "",
            "texto": txt.replace("\n", " ").replace('"', "'"),
        })
    return filas


def bajar(handle, maximo):
    u = lookup(handle)
    uid = u["id"]
    print("Bajando timeline de @%s (id=%s), tope %d posts" % (handle, uid, maximo))

    posts, medios, tokpag = [], {}, None
    while len(posts) < maximo:
        params = {
            "max_results": 100,
            "tweet.fields": "created_at,text,attachments,entities",
            "expansions": "attachments.media_keys",
            "media.fields": "url,preview_image_url,type",
        }
        if tokpag:
            params["pagination_token"] = tokpag
        d = get("/users/%s/tweets" % uid, params)

        lote = d.get("data", [])
        if not lote:
            print("  sin mas resultados.")
            break
        posts.extend(lote)

        for m in (d.get("includes") or {}).get("media", []):
            medios[m["media_key"]] = m.get("url") or m.get("preview_image_url") or ""

        print("  %d posts (ultimo: %s) — costo acumulado ~$%.2f"
              % (len(posts), lote[-1]["created_at"][:10], len(posts) * COSTO_LECTURA))

        tokpag = (d.get("meta") or {}).get("next_token")
        if not tokpag:
            print("  fin del timeline (tope de 3200 o cuenta agotada).")
            break

    with open(RAW_JSON, "w", encoding="utf-8") as f:
        json.dump({"handle": handle, "posts": posts, "media": medios}, f, ensure_ascii=False, indent=1)
    print("crudo -> %s (%d posts)" % (RAW_JSON, len(posts)))

    filas = parsear(posts, medios)
    if not filas:
        print("Ningun post matcheo patrones de corte. Revisa el crudo antes de re-pagar.")
        return

    import csv
    cols = list(filas[0].keys())
    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(filas)

    con_horas = sum(1 for r in filas if r["duracion_horas"] != "NA")
    con_img = sum(1 for r in filas if r["tiene_imagen"] == "si")
    print("parseado -> %s" % OUT_CSV)
    print("  cortes detectados : %d" % len(filas))
    print("  con duracion_horas: %d (%.0f%%)" % (con_horas, 100 * con_horas / len(filas)))
    print("  solo imagen (OCR pendiente): %d" % con_img)
    print("  rango: %s .. %s" % (filas[-1]["fecha_post"], filas[0]["fecha_post"]))
    print("\nNO se fusiona con cortes_interagua_raw.csv automaticamente:")
    print("revisar duplicados y fecha_inicio (aqui es la fecha del ANUNCIO) antes de unir.")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--handle", default=DEFAULT_HANDLE, help="cuenta de X sin @")
    ap.add_argument("--sondeo", action="store_true", help="solo estimar alcance (~$0.01)")
    ap.add_argument("--bajar", action="store_true", help="descargar timeline (paga por post)")
    ap.add_argument("--max", type=int, default=TOPE_TIMELINE)
    a = ap.parse_args()

    if a.sondeo:
        sondeo(a.handle)
    elif a.bajar:
        bajar(a.handle, min(a.max, TOPE_TIMELINE))
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
