# Diccionario de datos — VENTANA SECA

Dataset principal: `data/model/ventana_seca_guayaquil_weekly.csv`
Unidad de análisis: **Guayaquil × semana epidemiológica (ISO)**
Cobertura: **2021-W01 → 2026-W35 (295 semanas continuas, sin huecos)**
Fecha de construcción: 2026-09-04

Convención de confianza: **A** fuente primaria oficial · **B** secundaria confiable (prensa) · **C** inferido/calculado · **D** no verificado (p. ej. digitalización).

| variable | definición | unidad | fuente | periodo | transformación | NA significa |
|---|---|---|---|---|---|---|
| `semana_id` | identificador de semana ISO (`AAAA-Wss`) | — | calendario generado | 2021-2026 | `iso_week_calendar()` | — (nunca NA) |
| `anio_epi` | año epidemiológico ISO | año | derivado | | | — |
| `semana` | número de semana ISO (1–53) | — | derivado | | | — |
| `fecha_lunes` | lunes de la semana ISO | fecha | derivado | | | — |
| `casos_dengue` | casos de dengue Guayas/Guayaquil | conteo | — (no público semanal) | — | — | **NA = no existe serie semanal pública limpia** (requiere digitalizar Gaceta MSP o convenio DNVE) |
| `casos_unidad` | unidad geográfica de `casos_dengue` | texto | — | | | "NA" hasta llenar |
| `casos_dengue_nacional` | casos de dengue **Ecuador (nacional)** | conteo | OpenDengue / PAHO (confianza A) | 2015–2023 | serie semanal filtrada T_res=Week | NA fuera de 2015–2023 |
| `poblacion` | población proyectada de Guayaquil (cantón) | personas | INEC EPP Rev. 2024 (A) | 2021–2026 | valor anual asignado a cada semana del año | — |
| `corte_hn` | ¿hubo ≥1 corte de agua reportado iniciando esa semana? | 0/1 | Interagua/prensa (B, algunos A) | 2021–2026 | agregación por semana de `fecha_inicio` | 0 = **sin corte reportado** (ver `corte_reporte_confiable`) |
| `n_eventos_corte` | nº de cortes iniciados esa semana | conteo | idem | | idem | 0 = sin reporte |
| `horas_corte` | suma de duraciones de los cortes de la semana | horas | idem | | rango "4-10" → punto medio; NA no suma | 0 = sin corte o duración no reportada |
| `horas_corte_incompleta` | ≥1 corte de la semana tenía duración NA | 0/1 | idem | | flag | — |
| `almacenar` | ¿algún corte pidió almacenar agua? | 0/1 | idem | | max por semana | 0 = no lo pidieron o sin corte |
| `n_sectores` | suma de sectores **ejemplo** listados | conteo | idem | | subestimación (es "ejemplo", no total) | 0 = sin corte |
| `corte_reporte_confiable` | densidad de cobertura de prensa por año | alta/media/baja | evaluación propia (C) | | 2023-25=alta, 2026=media, 2021-22=baja | — |
| `precipitacion_mm` | lluvia semanal | mm | Open-Meteo ERA5 (A) | 2021–2026 | suma de diarios (semana completa) | — |
| `precip_7d/30d/90d` | lluvia acumulada móvil (1/4/13 semanas) | mm | idem | | rolling sum | primeras semanas del acumulado |
| `spi3/spi6/spi12` | índice estandarizado de precipitación (3/6/12 meses) | z | derivado de Open-Meteo (C) | | gamma por semana-año, calibrado 1991–2020 | — |
| `tmin/tmax/tmean` | temperatura semanal min/máx/media | °C | Open-Meteo ERA5 (A) | 2021–2026 | media semanal de diarios | — |
| `humedad` | humedad relativa media semanal | % | Open-Meteo ERA5 (A) | 2021–2026 | media semanal | — |

## Datasets fuente (carpetas)

- `data/raw/` — datos originales: `cortes_interagua_raw.csv`, `clima_guayaquil_diario.csv`, `poblacion_guayaquil_anual.csv`, `dengue_nacional_anual.csv`, `dengue_guayas_puntos_ancla.csv`, `dengue_ecuador_nacional_semanal_opendengue.csv`, `gacetas_msp/`.
- `data/clean/` — normalizados: `cortes_interagua_clean.csv`, `clima_guayaquil_semanal.csv`.
- `data/model/` — serie final: `ventana_seca_guayaquil_weekly.csv`.

## Reproducibilidad (orden de ejecución)

```
python scripts/download_climate.py            # clima real ERA5 -> semanal + SPI
python scripts/download_dengue_opendengue.py  # dengue nacional semanal (OpenDengue)
python scripts/clean_cortes.py                # limpia cortes
python scripts/build_dataset.py               # integra todo -> data/model/
# opcionales para ampliar:
python scripts/scrape_interagua.py            # snapshots Wayback de Interagua
python scripts/scrape_dengue_msp.py           # descarga Gacetas MSP para digitalizar Guayas
```
