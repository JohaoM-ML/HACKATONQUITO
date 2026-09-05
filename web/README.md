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

## Google Maps (panel del jefe)

El formulario del brigadista usa el GPS del teléfono. Google Maps va solo en `/mapa`
(hexágonos H3 de ~1 km sobre Guayaquil urbano + cerco perifocal).

1. En Google Cloud habilita **Maps JavaScript API**.
2. Crea una clave restringida por referrer (`http://localhost:3000/*`).
3. Pégala en `.env.local` como `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
4. Reinicia `npm run dev`.

Sin la clave el resto del panel funciona: solo se oculta el mapa.

## Seed

La cola demo (6 sectores Regla A) y la malla de minizonas ya están en la base.

```bash
# con service role en .env.local
npx tsx scripts/seed-cola.ts
npx tsx scripts/seed-minizonas.ts   # geocodifica con Google o usa centros públicos
```
