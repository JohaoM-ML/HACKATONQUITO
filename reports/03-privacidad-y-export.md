# C5 — Datos personales y export

Severidad: **P0** si hay (o va a haber) viviendas reales.

## Qué se guarda por vivienda

Tabla `visitas` (2 filas en vivo, ambas con GPS):

- `lat` / `lon` / `precision_m` / `h3`
- `codigo_vivienda`, `manzana`, `n_habitantes`
- contexto de agua, educación, reinspección

`GET /api/export/dataset` (solo comprueba `perfil.rol === 'jefe'`) vuelca eso a CSV, una fila por recipiente. No agrega, no anonimiza, no registra quién exportó.

El mapa del jefe pinta hexágonos H3 (~160 m) sobre esas visitas. El GPS crudo queda en Postgres.

## Por qué es crítico

Combinado con C1–C3:

- Un extraño se hace jefe o usa las cuentas del GitHub público.
- Llama al export.
- Se lleva coordenadas de hogares + ocupantes.

Ecuador: Ley Orgánica de Protección de Datos Personales. Coordenada de vivienda + código + habitantes es dato personal. Un hackatón no exime si el dataset sale del equipo.

El formulario **no pide consentimiento** informado al hogar. GPS no es obligatorio en UI, pero se guarda si el brigadista lo captura.

## Remediación

1. Export solo desde un job server-side con service role, disparado por un allowlist (no “cualquier jefe”).
2. CSV de investigación: `h3` sí, `lat`/`lon` de vivienda no, o jitter ≥ 100 m.
3. `n_habitantes` y `codigo_vivienda` fuera del export público del panel.
4. Audit log: quién exportó, cuándo, cuántas filas.
5. Texto de consentimiento en el paso 1 de la inspección si van a campo real.
6. Retention: borrar GPS crudo cuando la visita ya tiene `h3`.

Hasta entonces: no cargar visitas de hogares reales en este proyecto.
