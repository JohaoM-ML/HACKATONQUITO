# VENTANA SECA — Demo hackatón

Producto: **documento Interagua → motor de reglas A–D → cola.json → PWA offline → panel**.

## Cómo ejecutar

```bash
# 1. Generar cola (fecha de evaluación de la demo)
node src/motor/generar-cola.js --fecha 2026-02-15

# 2. Tests del motor
node src/motor/reglas.test.js

# 3. Servir la PWA (necesario para el service worker; no uses file://)
npx --yes serve src/app
```

Abre la URL que imprime `serve` (por ejemplo `http://localhost:3000`).

## Demo en ~3 minutos

1. **Inicio** — frase del producto + ficha del corte 8-feb-2026 (fuente Primicias, confianza B).
2. **Panel** — cola regla A, tendencia D (no sube), nota de que el modelo conjunto empeoró MAE 288→394.
3. **Brigada** — abrir un barrio (p. ej. Guasmo), leer justificación y fuente.
4. **Registrar predio** — casa, recipientes, tipo, larva → se guarda en IndexedDB.
5. **Modo avión** — la cola y los predios siguen; banner “SIN CONEXIÓN”.

## Qué es real / qué no

| Dato | Estado |
|------|--------|
| Cortes y sectores del CSV | Observados (lista *ejemplo*, puede estar incompleta) |
| Categoría A/B | Regla operativa aplicada |
| Regla B | Hipótesis Lowe — **no** hallazgo validado en Ecuador |
| Regla C | Contexto cantonal; **no** emite barrios (sin catálogo) |
| Regla D | Bonus de prioridad si casos suben; **no** define barrio |
| lat/lon | `null` |
| Predios | Solo los que registra el brigadista en campo |
| `data/cola.ejemplo.json` | Ejemplo antiguo — **no** lo usa la app |

## Archivos clave

- `src/motor/reglas.js` — motor A–D
- `src/motor/generar-cola.js` — escribe `data/cola.json` y `src/app/data/cola.json`
- `src/app/` — PWA (brigada + panel + service worker)
