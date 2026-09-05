# C2 / C6 / C7 / C8 / C9 — APIs públicas y operaciones

Severidad: **P0** (C2) y **P1** (resto).

## C2 — `POST /api/brigadas`

Sin cookie, sin secret, sin rate limit. Body: nombre, email, password, nombre_persona.

- Sin service role: `signUp` con `rol: "jefe"` y luego insert de brigada con el JWT del signup.
- Con service role: `admin.createUser` + `email_confirm: true` + upsert de perfil. Bypass RLS.

Cualquier script puede crear jefes. Si mañana pegan `SUPABASE_SERVICE_ROLE_KEY` en Vercel “para el seed”, este endpoint se vuelve admin remoto.

**Fix:** eliminar el endpoint o exigir `Authorization: Bearer <INVITE>` de un solo uso. Nunca `createUser` desde una ruta pública.

## C6 — WhatsApp / n8n

| Ruta | Auth | Problema |
|------|------|----------|
| `GET /api/public/cortes` | No. CORS `*` | Filtra cola Regla A + cortes. Cache 60 s. |
| `POST /api/public/whatsapp` | No. Sin `X-Twilio-Signature` | Cualquiera manda `Body` y recibe TwiML |
| n8n webhook `whatsapp-vecinos` | No | Quien tenga la URL dispara el flujo |

La cola operativa (qué barrios se van a visitar) no debería ser anónima. Los anuncios de Interagua sí pueden serlo.

**Fix:** validar firma Twilio (auth token solo en server). Secret en el webhook n8n. Quitar `cola_items` del payload público o firmar el GET.

## C7 — GRANTs de más

En vivo, `anon` tiene SELECT/INSERT/UPDATE/DELETE/TRUNCATE en **todas** las tablas `public`, incluidas `visitas` y `perfiles`. RLS hoy bloquea la escritura anónima, pero:

- una policy nueva mal puesta abre la mesa;
- el default ACL de `public` replica esos GRANTs en tablas futuras;
- `brigadas_insert_auth` + `WITH CHECK (true)` ya permite insert autenticado libre.

`anon` también tiene SELECT en `indices_sector`, `indices_minizona`, `cobertura_sector`. Con `security_invoker` las filas de visitas no pasan (anon no lee `visitas`). Sigue siendo superficie innecesaria.

**Fix:**

```sql
revoke insert, update, delete, truncate on all tables in schema public from anon;
-- dejar select solo en cortes, sectores (y cola si de verdad debe ser pública)
```

## C8 — Drift de migraciones

| Repo (`web/supabase/migrations/`) | Vivo (`list_migrations`) |
|-----------------------------------|--------------------------|
| `001_schema_inicial.sql` | `schema_inicial` |
| (no está) | `fix_brigadas_policies` ← aquí se abrió `brigadas_select_all` / insert auth |
| (no está) | `revoke_definer_execute` |
| `002_minizonas.sql` (todo junto) | `minizonas_y_cerco_perifocal` + `minizonas_vistas_y_rls` + `revocar_execute_en_funciones_trigger` |
| `003_public_cortes_anon.sql` | `public_cortes_anon_read` |

Reaplicar el repo sobre un proyecto nuevo **no** reproduce producción. Producción es más permisiva.

**Fix:** `supabase db pull` (o dump de policies) y commitear el SQL real. Dejar de usar `apply_migration` suelto.

## C9 — Service role en ruta pública

`web/lib/public/cortes.ts`:

```ts
const key = serviceKey || anon;
```

El README de n8n todavía pide `SUPABASE_SERVICE_ROLE_KEY` “porque RLS bloquea anon”. Eso era verdad **antes** de `003`. Hoy anon ya lee cortes/cola. Si ponen la service role “por si acaso”, `/api/public/*` ignora RLS. Un `select('*')` futuro filtra PII.

**Fix:** borrar el fallback a service role. Actualizar `n8n/README.md`.

## Extra (no P0)

- `/api/minizonas/cerco`: cualquier autenticado, sin comprobar que la visita sea suya más allá del SELECT RLS, ni que haya foco.
- `/api/health`: ok, no filtra secretos.
- Sin rate limit en signup, brigadas, whatsapp, cortes.
- `vercel.json` región `iad1` (US). Dato de hogares ecuatorianos fuera del país: revisar LOPDP / encargo.
