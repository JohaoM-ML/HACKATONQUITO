# Auditoría crítica — VENTANA SECA

**Fecha:** 5 de septiembre de 2026  
**Alcance:** app `web/` (Next.js 14 + Supabase), RLS en vivo (`ventana-seca` / `mfmseatpeepadupfhmtd`), WhatsApp/n8n, motor A–D, pipeline de datos.  
**No incluye:** exploits, payloads ni pasos de ataque. Solo hallazgos y remediación.

Hay **5 P0 explotables ahora**, **5 P1** y **2 P2 de integridad**. El canvas filtrable está junto al chat.

---

## Cadena que hay que cortar hoy

1. El registro y `POST /api/brigadas` permiten crear un **jefe** sin invitación.
2. Un usuario autenticado puede **cambiar su `rol` y `brigada_id`** (`perfiles_update_self`).
3. Anon **lista todas las brigadas** (`brigadas_select_all`).
4. Un jefe puede **borrar visitas de cualquier brigada** y **exportar GPS de hogares**.

Eso no es un bug de UI: está en trigger + RLS + API.

---

## P0 — explotable ahora

| ID | Hallazgo | Archivo / evidencia en vivo |
|----|----------|-----------------------------|
| C1 | Auto-asignación de rol `jefe` | `handle_new_user` usa `raw_user_meta_data`; `web/app/registro/page.tsx`; policy `perfiles_update_self` / `perfiles_insert_self` |
| C2 | Alta de jefe sin auth | `web/app/api/brigadas/route.ts` |
| C3 | Cuentas demo en GitHub **público** | `web/components/auth/RoleLogin.tsx` · https://github.com/JohaoM-ML/HACKATONQUITO · 2 users en prod |
| C4 | Jefe global, no por brigada | policies `visitas_delete_own`, `minizonas_delete_jefe`, `asig_mini_*`, updates de asignaciones |
| C5 | Export de GPS / hogar por cualquier jefe | `web/app/api/export/dataset/route.ts` · columnas `lat`, `lon`, `n_habitantes`, `codigo_vivienda` |

Detalle: [01-seguridad-auth-rls.md](01-seguridad-auth-rls.md), [02-secretos-y-cuentas-demo.md](02-secretos-y-cuentas-demo.md), [03-privacidad-y-export.md](03-privacidad-y-export.md).

## P1 — alto

| ID | Hallazgo |
|----|----------|
| C6 | WhatsApp/n8n sin firma ni auth |
| C7 | `GRANT` total a `anon` + `brigadas_insert_auth` con `WITH CHECK true` |
| C8 | 7 migraciones en vivo vs 3 archivos en el repo |
| C9 | `createPublicSupabase()` prefiere service role |
| C10 | Maps key `NEXT_PUBLIC_`, confirm-email off, leaked-password protection off |

Detalle: [04-apis-publicas-y-ops.md](04-apis-publicas-y-ops.md).

## P2 — integridad del pitch

| ID | Hallazgo |
|----|----------|
| C11 | No hay casos de dengue a escala barrio; 0 semanas 2023 con cola ∩ incidencia alta |
| C12 | HI/CI/BI con n=2; Regla A casi ciega (19/21 cortes 2023 sin horas); 99.96% es catálogo, no campo |

Detalle: [05-integridad-cientifica.md](05-integridad-cientifica.md).

---

## Qué está bien

- Sesión con `getUser()`, no `getSession()`.
- Triggers `security definer` en `public` tienen `REVOKE EXECUTE` para `anon`/`authenticated`.
- Schema `private` sin `USAGE` (las helpers no son RPC).
- Vistas `security_invoker = true`.
- `.env.local` no está en git (`.env.*` en `.gitignore`).
- El copy del motor **no** promete reducción de dengue.

## Producción (conteos, sin PII)

1 brigada · 2 perfiles · 6 sectores · 6 cortes · 6 ítems de cola · 267 minizonas · 45 asignaciones · 2 visitas · 2 recipientes · 0 cercos.

## Parche en este orden

1. Rotar/borrar las dos cuentas demo. Cerrar signup abierto.
2. Trigger: rol siempre `brigadista` salvo invite server-side. Congelar `rol` y `brigada_id` en UPDATE.
3. Policies de jefe filtradas por `brigada_id`.
4. Deshabilitar `POST /api/brigadas` o exigir secret de un solo uso.
5. Quitar `DEMO` del cliente y del historial público.
6. `REVOKE` escritura a `anon`. `supabase db pull` para alinear migraciones.
