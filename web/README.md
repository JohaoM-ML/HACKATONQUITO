# VENTANA SECA — web app

Next.js 14 + Supabase. Roles: brigadista / jefe. Captura entomológica → índices HI/CI/BI.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

En Supabase Dashboard → Authentication → Providers: desactivar confirmación de email para la demo.

## Estructura

- `app/(auth routes)` — login, registro
- `app/ruta`, `inspeccion`, `mis-registros`, `perfil` — brigadista
- `app/panel`, `mapa`, `cola`, `equipo`, `avisos` — jefe
- `app/api/export/dataset` — CSV a nivel recipiente
- `lib/motor/reglas.ts` — motor A–D
- `supabase/migrations/` — schema + RLS

## Seed

La cola demo (6 sectores Regla A) ya está en la base. Para regenerar desde `../data/cola.json`:

```bash
# con service role en .env.local
npx tsx scripts/seed-cola.ts
```
