# C11 / C12 — Integridad científica y del pitch

Severidad: **P2** para seguridad, **crítica** si el jurado evalúa evidencia.

El README ya es honesto en la tabla “Qué es real / qué no”. El riesgo es que el panel (HI/CI/BI, % cobertura, “99.96% de trabajo evitado”) se lea como impacto epidemiológico.

## C11 — no hay Y de dengue a escala barrio

- `casos_dengue` en el dataset semanal es NA. No hay serie pública limpia Guayaquil × barrio × semana.
- `results/tablero_dos_piezas.json` pieza 1: MAE test 2023 = 87 casos, modelo **nacional**, fórmula AR(1) + offset de población. Nota explícita: *“No define barrio. No usa cortes.”*
- Coincidencia 2023: umbral p75 = 662.5 casos nacionales; **0** semanas altas con cola; 13 altas sin cola; 2 cola sin alta.

No hay base para decir que la cola predice brotes ni que los reduce.

Regla D (“cantón con casos subiendo”) tampoco localiza barrio. Regla B es hipótesis 7–14 días, **no validada en Ecuador** (el propio `reglas.ts` lo dice).

## C12 — índices y Regla A con muy poca señal

Estado vivo (5 sep 2026):

| Métrica | Valor |
|---------|-------|
| Visitas | 2 |
| Recipientes | 2 |
| Minizonas | 267 |
| Cercos abiertos | 0 |
| Cortes 2023 con duración | 2 / 21 |
| Cortes 2023 sin horas | 19 |

OPS usa HI 4 / CI 3 / BI 5 sobre **denominadores LIRAa** (decenas–cientos de viviendas por conglomerado). Con 2 inspecciones el número en el panel es ruido. Mostrarlo junto a umbrales OPS implica validez que no existe.

Regla A exige ≥8 h + pedido de almacenar + 0–14 días. Si 19 de 21 cortes de 2023 no tienen horas, A casi no dispara. El “99.96% de trabajo evitado vs visitar todo el catálogo cada semana” (`visitas_si_se_recorre_catalogo_cada_semana = 9932`) es un contrafactual de inventario, no un resultado de campo.

Cortes fuente: prensa (confianza B), sectores “ejemplo”, no el universo Interagua.

## Qué sí se puede afirmar

- Cola operativa a partir de cortes **observados** (Regla A).
- Captura de HI/CI/BI **cuando** haya denominador de verdad.
- Cobertura de minizonas / cercos como KPI de proceso (el README ya lo llama “KPI honesto”).

## Qué no poner en slides

- “Predicción de dengue por barrio”.
- “Reducción de casos”.
- HI/CI/BI en rojo/verde con n &lt; meta LIRAa.
- 99.96% como evidencia de eficiencia real.
- Regla B como validada.

El motor en `web/lib/motor/reglas.ts` está bien etiquetado. El panel no siempre hereda esa etiqueta.
