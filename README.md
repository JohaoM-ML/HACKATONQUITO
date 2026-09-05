# VENTANA SECA

Cola de brigadas antidengue a partir de cortes de agua (Reglas A–D) + captura entomológica en campo (índices HI / CI / BI) para construir el dataset que hoy no existe a escala de barrio.

## App (producción hackatón)

La app vive en [`web/`](web/): **Next.js 14 + Supabase Auth** con roles `brigadista` y `jefe`.

```bash
cd web
cp .env.example .env.local   # ya hay .env.local apuntando al proyecto ventana-seca
npm install
npm run dev
```

Abre http://localhost:3000

1. **Authentication → Providers** en Supabase: desactiva "Confirm email" para demo rápida.
2. Regístrate como **jefe** (crea la brigada) y luego como **brigadista** (elige esa brigada).
3. La cola Regla A ya está sembrada (6 sectores de `data/cola.json`).

### Roles

| Rol | Rutas |
|-----|--------|
| Brigadista | `/ruta`, `/inspeccion/[sectorId]`, `/mis-registros`, `/perfil` |
| Jefe | `/panel`, `/mapa`, `/cola`, `/equipo`, `/avisos` + export CSV |

### Captura entomológica

El brigadista registra por vivienda: estado de visita (denominador LIRAa), contexto de agua/almacenamiento, y **un recipiente por fila** (tipo, tapado, larvas/pupas). El panel del jefe calcula HI/CI/BI contra umbrales OPS (4 / 3 / 5).

### Scripts

```bash
cd web
npx tsx lib/motor/reglas.test.ts    # tests del motor portado
npx tsx scripts/seed-cola.ts        # requiere SUPABASE_SERVICE_ROLE_KEY
```

## Motor de reglas (también en Node vanilla)

```bash
node src/motor/generar-cola.js --fecha 2026-02-15
node src/motor/reglas.test.js
```

La PWA vanilla quedó archivada en [`_archivo/pwa-vanilla/`](_archivo/pwa-vanilla/) (ya no es el entregable). La app es **online** (Supabase); no se afirma funcionamiento sin internet.

## Qué es real / qué no

| Dato | Estado |
|------|--------|
| Cortes y sectores del CSV | Observados (lista ejemplo) |
| Regla A | Operativa: ≥8 h + almacenar + 0–14 d |
| Regla B | Hipótesis biológica 7–14 d — **no** validada en Ecuador |
| HI/CI/BI | Se calculan con visitas de campo; umbrales OPS citables |
| Predicción dengue por barrio | **No** — falta Y pública a esa escala (convenio MSP) |
| Offline | **No** en la app Next.js (decisión del equipo) |

## Stack

- Next.js 14 App Router + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS) — proyecto `ventana-seca`
- Motor A–D en [`web/lib/motor/reglas.ts`](web/lib/motor/reglas.ts) (port de `src/motor/reglas.js`)

## Deploy

Conecta `web/` a Vercel, define `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` y (opcional) `SUPABASE_SERVICE_ROLE_KEY` solo en server.
