"""
scrape_dengue_msp.py — VENTANA SECA
Ruta REPRODUCIBLE para obtener la Y semanal de dengue a nivel GUAYAS (provincia),
que es la mejor resolucion subnacional realmente alcanzable para 2021-2026.

HALLAZGO (verificado):
  - El MSP publica Gacetas ETV semanales (PDF) en:
      https://www.salud.gob.ec/gaceta-epidemiologica-ecuador-sive-alerta/
  - Cada Gaceta 2026 incluye la figura:
      "Casos de dengue en GUAYAS, historico desde 2021 hasta 2026 por semana epidemiologica"
    PERO los valores estan como PUNTOS DE GRAFICO (glifos), no como tabla -> hay que DIGITALIZAR.
  - No existe CSV/tabla oficial con Guayas semanal 2021-2026. datosabiertos.gob.ec no lo tiene.
  - OpenDengue si trae Ecuador NACIONAL semanal 2015-2023 (ver download_dengue_opendengue.py)
    y Guayas semanal SOLO <=2020.

DOS RUTAS PARA LLENAR casos_dengue (Guayas semanal):
  RUTA A (recomendada, rapida): digitalizar el grafico "GUAYAS historico por SE" de la Gaceta
    ETV mas reciente con WebPlotDigitizer (https://apps.automeris.io/wpd/):
      1. Descargar el PDF (ver GACETAS abajo) y exportar la pagina de la figura a PNG.
      2. Cargar en WebPlotDigitizer, calibrar ejes (X=SE 1..52, Y=casos).
      3. Extraer una serie por anio -> exportar CSV (semana, casos, anio).
      4. Guardar como data/raw/dengue_guayas_semanal_digitalizado.csv con columna confianza=D
         (digitalizacion) hasta validar contra los puntos-ancla (SE28-2026 Guayas=5909).
  RUTA B (oficial, lenta): oficio de datos abiertos a la DNVE-MSP solicitando la base EPI-1
    de dengue por canton/semana. Esta seria confianza A pero requiere convenio/tramite.

GACETAS DE REFERENCIA (descargables hoy):
  - ETV SE14-2026: https://www.salud.gob.ec/wp-content/uploads/2026/04/ETV_Gaceta_14-1.pdf
  - ETV SE13-2026: https://www.salud.gob.ec/wp-content/uploads/2026/04/ETV_Gaceta_13.pdf
  - Boletin Dengue SE05-2025: https://www.salud.gob.ec/wp-content/uploads/2025/01/Dengue-SE-05.pdf
  - ETV SE10-2025: https://www.salud.gob.ec/wp-content/uploads/2025/03/ENFERMEDADES-TRANSMITIDAS-POR-VECTORES-SE-10-2025-OK.pdf

Este script descarga las Gacetas disponibles a data/raw/gacetas_msp/ para que puedan
digitalizarse. NO extrae cifras automaticamente (los PDF traen la serie como grafico).
"""
import os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "data", "raw", "gacetas_msp")
os.makedirs(DEST, exist_ok=True)

GACETAS = {
    "ETV_Gaceta_14-2026.pdf": "https://www.salud.gob.ec/wp-content/uploads/2026/04/ETV_Gaceta_14-1.pdf",
    "ETV_Gaceta_13-2026.pdf": "https://www.salud.gob.ec/wp-content/uploads/2026/04/ETV_Gaceta_13.pdf",
    "Dengue_SE05-2025.pdf": "https://www.salud.gob.ec/wp-content/uploads/2025/01/Dengue-SE-05.pdf",
    "ETV_SE10-2025.pdf": "https://www.salud.gob.ec/wp-content/uploads/2025/03/ENFERMEDADES-TRANSMITIDAS-POR-VECTORES-SE-10-2025-OK.pdf",
}
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36"}


def main():
    for name, url in GACETAS.items():
        dest = os.path.join(DEST, name)
        if os.path.exists(dest):
            print("ya existe:", name); continue
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
            with open(dest, "wb") as f:
                f.write(data)
            print(f"OK  {name}  ({len(data)//1024} KB)")
        except Exception as e:
            print(f"FAIL {name}: {e}")
    print("\nSIGUIENTE PASO: digitalizar la figura 'GUAYAS historico por SE' con WebPlotDigitizer")
    print("-> guardar data/raw/dengue_guayas_semanal_digitalizado.csv (semana,anio,casos,confianza=D)")


if __name__ == "__main__":
    main()
