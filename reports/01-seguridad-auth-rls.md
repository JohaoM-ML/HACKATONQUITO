# C1 / C4 — Escalada de privilegios y RLS

Severidad: **P0**. Superficie: Auth + Row Level Security en `ventana-seca`.

## Qué está roto

El comentario del schema dice que el rol no vive en el JWT. Eso es correcto e insuficiente: el rol se toma de `user_metadata` en el **INSERT** y después el propio usuario puede **cambiarlo**.

### C1 — cualquiera se hace jefe

1. `public.handle_new_user()` (security definer, confirmado en vivo):

```sql
v_rol text := coalesce(new.raw_user_meta_data->>'rol', 'brigadista');
v_brigada uuid := nullif(new.raw_user_meta_data->>'brigada_id', '')::uuid;
```

`raw_user_meta_data` lo controla el cliente en `signUp({ options: { data } })`.

2. `web/app/registro/page.tsx` ofrece el chip **Jefe de brigada** y manda `rol` + `brigada_id` en el metadata. Después hace `perfiles.upsert({ rol })`.

3. Policy live `perfiles_insert_self`: `WITH CHECK (id = auth.uid())` — no restringe `rol`.

4. Policy live `perfiles_update_self`: `USING / WITH CHECK (id = auth.uid())` — **no congela columnas**. Un brigadista puede:

```
update perfiles set rol = 'jefe', brigada_id = '<id listado>' where id = auth.uid();
```

5. `POST /api/brigadas` (sin sesión) crea el usuario con `rol: "jefe"` y, si hay service role, con `email_confirm: true`.

El middleware solo pregunta “¿hay user?”. No pregunta el rol. Las páginas usan `requireRol`, pero el cliente Supabase y las policies no.

### C4 — jefe no está aislado por brigada

En vivo (no solo en `001_schema_inicial.sql`):

| Policy | Condición real | Debería ser |
|--------|----------------|-------------|
| `visitas_delete_own` | `brigadista_id = uid OR mi_rol() = 'jefe'` | jefe **y** `brigada_id = mi_brigada_id()` |
| `recipientes_delete` | visita propia **o** cualquier jefe | jefe de la misma brigada |
| `asignaciones_update_propio_o_jefe` | `mi_rol() = 'jefe'` | misma brigada |
| `asig_mini_update` / `asig_mini_delete_jefe` | cualquier jefe | misma brigada |
| `minizonas_delete_jefe` / `minizonas_update` | cualquier jefe | misma brigada (o no borrar malla ajena) |
| `asignaciones_insert_jefe` | `mi_rol() = 'jefe'` | solo brigadistas de su brigada |

Encadenado con C1: un auto-jefe borra visitas, recipientes y hexágonos de **todas** las brigadas.

`brigadas_insert_auth` en vivo es `WITH CHECK (true)`: cualquier autenticado inserta brigadas. `brigadas_select_all` deja leer IDs a **anon**.

## Remediación

```sql
-- 1) Trigger: ignorar metadata para autorización
v_rol text := 'brigadista';
-- brigada_id solo si existe un invite server-side, nunca del metadata

-- 2) Congelar columnas sensibles
create policy perfiles_update_self on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select rol from public.perfiles where id = auth.uid())
    and brigada_id is not distinct from (select brigada_id from public.perfiles where id = auth.uid())
  );

-- 3) Toda mutación de jefe: AND brigada_id = private.mi_brigada_id()
-- 4) DROP brigadas_insert_auth; INSERT solo service_role
-- 5) Quitar brigadas_select_all para anon
```

Quitar el selector de rol en `/registro`. Crear jefes solo con invite (tabla `invites` + service role) o a mano en el dashboard.

## Verificación

- `signUp` con `data.rol = 'jefe'` debe dejar el perfil en `brigadista`.
- `update perfiles set rol = 'jefe'` debe fallar.
- Un jefe de la brigada A no puede `delete` visitas con `brigada_id` de B.
- Anon no lista `brigadas.id`.
