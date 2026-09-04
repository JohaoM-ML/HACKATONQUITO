# VENTANA SECA — Demo hackatón

Producto: **documento Interagua → motor de reglas A–D → cola.json → PWA offline → panel**.

Una sola PWA. Dos roles (brigadista / jefe de brigada). Avisos al vecino solo por WhatsApp.

## Cómo ejecutar

```bash
# 1. Generar cola (fecha de evaluación de la demo)
node src/motor/generar-cola.js --fecha 2026-02-15

# 2. Tests del motor
node src/motor/reglas.test.js

# 3. Servir la PWA (necesario para el service worker; no uses file://)
#    serve.json desactiva cleanUrls (evita 301 que rompen el SW)
cd src/app
npx --yes serve . -l 3456 -c serve.json
```

Abre `http://localhost:3456/` (o el puerto que imprima `serve`).

Si ya tenías un service worker viejo: DevTools → Application → Unregister, luego recarga forzada (`Ctrl+Shift+R`).

## Demo en ~3 minutos

1. **Elegir rol** — Soy brigadista / Soy jefe de brigada.
2. **Brigadista → Cola** — abrir un barrio A, leer justificación, guardar predio.
3. **Modo avión** — la cola y el predio siguen; banner “SIN CONEXIÓN”.
4. **Ajustes → Cambiar de rol → Jefe** — resumen con cobertura real del dispositivo.
5. **Avisos** — Enviar por WhatsApp (abre selector de contacto) o Copiar. Sin SMS.

## Qué es real / qué no

| Dato | Estado |
|------|--------|
| Cortes y sectores del CSV | Observados (lista *ejemplo*, puede estar incompleta) |
| Categoría A/B | Regla operativa aplicada |
| Regla B | Ventana 7–14 d (ciclo Aedes aegypti). Hipótesis biológica — **no** hallazgo validado en Ecuador. La ventana previa de 12–20 sem (rezago Lowe) se descartó: sin efecto significativo en `results/lag_effects.csv` |
| Regla C | Contexto cantonal; **no** emite barrios |
| Regla D | Bonus de prioridad si casos suben; **no** define barrio |
| lat/lon | `null` |
| Predios | Solo los que registra el brigadista en campo |
| Números WhatsApp | No hay padrón; `wa.me/?text=` abre el selector |

## Archivos clave

- `src/motor/reglas.js` — motor A–D
- `src/motor/generar-cola.js` — escribe `data/cola.json` y `src/app/data/cola.json`
- `src/app/index.html` — shell único
- `src/app/ui.js` — router hash + vistas por rol
- `src/app/app.js` — cola, IndexedDB, rol, WhatsApp helpers
- `src/app/sw.js` — offline (cache v4)
