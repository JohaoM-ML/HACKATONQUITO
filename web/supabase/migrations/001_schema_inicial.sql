-- VENTANA SECA — schema inicial + RLS + vista de índices entomológicos
-- Roles: brigadista | jefe. brigada_id nunca se acepta del body; se deriva de la sesión.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.brigadas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  canton text not null default 'Guayaquil',
  jefe_id uuid,
  created_at timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  rol text not null check (rol in ('brigadista', 'jefe')),
  brigada_id uuid references public.brigadas(id) on delete set null,
  telefono text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.brigadas
  add constraint brigadas_jefe_fk
  foreign key (jefe_id) references public.perfiles(id) on delete set null;

create table public.sectores (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nombre text not null,
  zona text,
  lat double precision,
  lon double precision,
  created_at timestamptz not null default now()
);

create table public.cortes (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectores(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date,
  duracion_horas text,
  duracion_horas_num double precision,
  pidio_almacenar boolean,
  motivo text,
  tipo_corte text,
  fuente text,
  url text,
  confianza text,
  created_at timestamptz not null default now()
);

create index cortes_sector_fecha_idx on public.cortes (sector_id, fecha_inicio desc);

create table public.cola_items (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectores(id) on delete cascade,
  corte_id uuid references public.cortes(id) on delete set null,
  fecha_eval date not null,
  regla text check (regla in ('A', 'B', 'C')),
  puntaje numeric not null default 0,
  prioridad int,
  accion text,
  justificacion text,
  hipotesis boolean not null default false,
  requiere_confirmacion_humana boolean not null default false,
  label_regla text,
  aplica_d boolean not null default false,
  evidencias jsonb not null default '[]'::jsonb,
  incertidumbre jsonb not null default '[]'::jsonb,
  origen_dato jsonb not null default '[]'::jsonb,
  confianza text,
  created_at timestamptz not null default now()
);

create index cola_items_fecha_regla_idx on public.cola_items (fecha_eval, regla, prioridad);

create table public.asignaciones (
  id uuid primary key default gen_random_uuid(),
  cola_item_id uuid not null references public.cola_items(id) on delete cascade,
  brigadista_id uuid not null references public.perfiles(id) on delete cascade,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'visitado', 'omitido')),
  asignado_en timestamptz not null default now(),
  unique (cola_item_id, brigadista_id)
);

create index asignaciones_brigadista_idx on public.asignaciones (brigadista_id, estado);

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectores(id) on delete cascade,
  cola_item_id uuid references public.cola_items(id) on delete set null,
  brigadista_id uuid not null references public.perfiles(id) on delete cascade,
  brigada_id uuid references public.brigadas(id) on delete set null,
  estado_visita text not null
    check (estado_visita in ('inspeccionada', 'cerrada', 'renuente', 'deshabitada')),
  codigo_vivienda text,
  manzana text,
  lat double precision,
  lon double precision,
  precision_m double precision,
  fecha_hora timestamptz not null default now(),
  -- contexto hogar
  n_habitantes int,
  tiene_conexion_red boolean,
  dias_sin_agua_ultima_semana int check (dias_sin_agua_ultima_semana is null or (dias_sin_agua_ultima_semana between 0 and 7)),
  horas_agua_por_dia text
    check (horas_agua_por_dia is null or horas_agua_por_dia in ('menos_4', '4_8', '8_16', 'todo_el_dia')),
  almacena_agua boolean,
  motivo_almacenamiento text
    check (motivo_almacenamiento is null or motivo_almacenamiento in (
      'corte_programado', 'corte_emergente', 'presion_baja', 'costumbre', 'no_aplica'
    )),
  dias_almacenada int,
  recibio_tanquero boolean,
  -- acción
  se_educo_hogar boolean,
  material_entregado boolean,
  requiere_reinspeccion boolean,
  notas text,
  created_at timestamptz not null default now()
);

create index visitas_sector_fecha_idx on public.visitas (sector_id, fecha_hora desc);
create index visitas_brigada_idx on public.visitas (brigada_id, fecha_hora desc);
create index visitas_brigadista_idx on public.visitas (brigadista_id, fecha_hora desc);

create table public.recipientes (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas(id) on delete cascade,
  tipo text not null check (tipo in (
    'tanque_elevado', 'tanque_bajo', 'cisterna', 'barril_tambor', 'balde_tina',
    'llanta', 'florero_planta', 'canaleta', 'chatarra_escombro', 'bebedero_animal', 'otro'
  )),
  uso text check (uso is null or uso in (
    'almacenamiento_consumo', 'almacenamiento_limpieza', 'desecho', 'decorativo'
  )),
  capacidad_l text check (capacidad_l is null or capacidad_l in (
    'menos_20', '20_100', '100_500', 'mas_500'
  )),
  tapado text check (tapado is null or tapado in ('si', 'parcial', 'no')),
  con_agua boolean,
  ubicacion text check (ubicacion is null or ubicacion in ('interior', 'patio', 'techo')),
  positivo_larvas boolean,
  positivo_pupas boolean,
  n_pupas text check (n_pupas is null or n_pupas in ('1_10', '11_50', 'mas_50')),
  tratado text check (tratado is null or tratado in ('larvicida', 'eliminado', 'tapado', 'ninguno')),
  foto_url text,
  created_at timestamptz not null default now()
);

create index recipientes_visita_idx on public.recipientes (visita_id);

-- ---------------------------------------------------------------------------
-- Vista: índices Stegomyia por sector y semana (security_invoker = RLS)
-- HI umbral 4 | CI umbral 3 | BI umbral 5 (OPS)
-- ---------------------------------------------------------------------------

create or replace view public.indices_sector
with (security_invoker = true)
as
with base as (
  select
    v.sector_id,
    date_trunc('week', v.fecha_hora)::date as semana,
    v.id as visita_id,
    v.estado_visita,
    exists (
      select 1 from public.recipientes r
      where r.visita_id = v.id
        and (r.positivo_larvas is true or r.positivo_pupas is true)
    ) as vivienda_positiva
  from public.visitas v
),
agg_visitas as (
  select
    sector_id,
    semana,
    count(*) filter (where estado_visita = 'inspeccionada') as viviendas_inspeccionadas,
    count(*) filter (where estado_visita = 'inspeccionada' and vivienda_positiva) as viviendas_positivas,
    count(*) as visitas_totales
  from base
  group by sector_id, semana
),
agg_recip as (
  select
    v.sector_id,
    date_trunc('week', v.fecha_hora)::date as semana,
    count(r.*) filter (where v.estado_visita = 'inspeccionada') as recipientes_inspeccionados,
    count(r.*) filter (
      where v.estado_visita = 'inspeccionada'
        and (r.positivo_larvas is true or r.positivo_pupas is true)
    ) as recipientes_positivos,
    count(r.*) filter (
      where v.estado_visita = 'inspeccionada'
        and (r.positivo_larvas is true or r.positivo_pupas is true)
        and r.uso in ('almacenamiento_consumo', 'almacenamiento_limpieza')
    ) as positivos_almacenamiento
  from public.visitas v
  left join public.recipientes r on r.visita_id = v.id
  group by v.sector_id, date_trunc('week', v.fecha_hora)::date
)
select
  s.id as sector_id,
  s.nombre as sector_nombre,
  s.zona,
  a.semana,
  a.viviendas_inspeccionadas,
  a.viviendas_positivas,
  coalesce(r.recipientes_inspeccionados, 0) as recipientes_inspeccionados,
  coalesce(r.recipientes_positivos, 0) as recipientes_positivos,
  coalesce(r.positivos_almacenamiento, 0) as positivos_almacenamiento,
  case when a.viviendas_inspeccionadas > 0
    then round(100.0 * a.viviendas_positivas / a.viviendas_inspeccionadas, 2)
    else null end as hi,
  case when coalesce(r.recipientes_inspeccionados, 0) > 0
    then round(100.0 * r.recipientes_positivos / r.recipientes_inspeccionados, 2)
    else null end as ci,
  case when a.viviendas_inspeccionadas > 0
    then round(100.0 * coalesce(r.recipientes_positivos, 0) / a.viviendas_inspeccionadas, 2)
    else null end as bi,
  case when coalesce(r.recipientes_positivos, 0) > 0
    then round(100.0 * r.positivos_almacenamiento / r.recipientes_positivos, 2)
    else null end as pct_positivos_almacenamiento,
  4::numeric as umbral_hi,
  3::numeric as umbral_ci,
  5::numeric as umbral_bi
from agg_visitas a
join public.sectores s on s.id = a.sector_id
left join agg_recip r on r.sector_id = a.sector_id and r.semana = a.semana;

-- ---------------------------------------------------------------------------
-- Helpers de sesión (security definer en schema privado)
-- ---------------------------------------------------------------------------

create schema if not exists private;

create or replace function private.mi_perfil()
returns public.perfiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.perfiles where id = auth.uid();
$$;

create or replace function private.mi_brigada_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select brigada_id from public.perfiles where id = auth.uid();
$$;

create or replace function private.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;

-- Trigger: crear perfil al registrarse (rol/nombre desde raw_user_meta_data solo al INSERT;
-- autorización posterior vive en perfiles, NO en JWT user_metadata)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text := coalesce(new.raw_user_meta_data->>'rol', 'brigadista');
  v_nombre text := coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1));
  v_brigada uuid := nullif(new.raw_user_meta_data->>'brigada_id', '')::uuid;
begin
  if v_rol not in ('brigadista', 'jefe') then
    v_rol := 'brigadista';
  end if;
  insert into public.perfiles (id, nombre, rol, brigada_id)
  values (new.id, v_nombre, v_rol, v_brigada);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Actualizar lat/lon del sector con promedio de visitas GPS
create or replace function public.refresh_sector_coords()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lat is not null and new.lon is not null and new.estado_visita = 'inspeccionada' then
    update public.sectores s
    set
      lat = sub.avg_lat,
      lon = sub.avg_lon
    from (
      select avg(lat) as avg_lat, avg(lon) as avg_lon
      from public.visitas
      where sector_id = new.sector_id
        and lat is not null and lon is not null
        and estado_visita = 'inspeccionada'
    ) sub
    where s.id = new.sector_id;
  end if;
  return new;
end;
$$;

drop trigger if exists visitas_refresh_coords on public.visitas;
create trigger visitas_refresh_coords
  after insert or update of lat, lon on public.visitas
  for each row execute function public.refresh_sector_coords();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.brigadas enable row level security;
alter table public.perfiles enable row level security;
alter table public.sectores enable row level security;
alter table public.cortes enable row level security;
alter table public.cola_items enable row level security;
alter table public.asignaciones enable row level security;
alter table public.visitas enable row level security;
alter table public.recipientes enable row level security;

-- Perfiles
create policy perfiles_select_propia_brigada on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or brigada_id = private.mi_brigada_id()
  );

create policy perfiles_update_self on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Brigadas
create policy brigadas_select_miembros on public.brigadas
  for select to authenticated
  using (id = private.mi_brigada_id());

-- Sectores / cortes / cola: lectura para autenticados (cola operativa pública dentro de la org)
create policy sectores_select_auth on public.sectores
  for select to authenticated using (true);

create policy cortes_select_auth on public.cortes
  for select to authenticated using (true);

create policy cola_select_auth on public.cola_items
  for select to authenticated using (true);

-- Asignaciones: brigadista ve las suyas; jefe ve las de su brigada
create policy asignaciones_select on public.asignaciones
  for select to authenticated
  using (
    brigadista_id = auth.uid()
    or exists (
      select 1 from public.perfiles p
      where p.id = asignaciones.brigadista_id
        and p.brigada_id = private.mi_brigada_id()
        and private.mi_rol() = 'jefe'
    )
  );

create policy asignaciones_insert_jefe on public.asignaciones
  for insert to authenticated
  with check (private.mi_rol() = 'jefe');

create policy asignaciones_update_propio_o_jefe on public.asignaciones
  for update to authenticated
  using (
    brigadista_id = auth.uid()
    or private.mi_rol() = 'jefe'
  )
  with check (
    brigadista_id = auth.uid()
    or private.mi_rol() = 'jefe'
  );

-- Visitas: brigadista inserta/lee las suyas; jefe lee toda su brigada
create policy visitas_select on public.visitas
  for select to authenticated
  using (
    brigadista_id = auth.uid()
    or (brigada_id = private.mi_brigada_id() and private.mi_rol() = 'jefe')
  );

create policy visitas_insert_own on public.visitas
  for insert to authenticated
  with check (
    brigadista_id = auth.uid()
    and (brigada_id is null or brigada_id = private.mi_brigada_id())
  );

create policy visitas_update_own on public.visitas
  for update to authenticated
  using (brigadista_id = auth.uid())
  with check (brigadista_id = auth.uid());

create policy visitas_delete_own on public.visitas
  for delete to authenticated
  using (brigadista_id = auth.uid() or private.mi_rol() = 'jefe');

-- Recipientes: vía visita del mismo brigadista / jefe de brigada
create policy recipientes_select on public.recipientes
  for select to authenticated
  using (
    exists (
      select 1 from public.visitas v
      where v.id = recipientes.visita_id
        and (
          v.brigadista_id = auth.uid()
          or (v.brigada_id = private.mi_brigada_id() and private.mi_rol() = 'jefe')
        )
    )
  );

create policy recipientes_insert on public.recipientes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.visitas v
      where v.id = recipientes.visita_id
        and v.brigadista_id = auth.uid()
    )
  );

create policy recipientes_update on public.recipientes
  for update to authenticated
  using (
    exists (
      select 1 from public.visitas v
      where v.id = recipientes.visita_id and v.brigadista_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.visitas v
      where v.id = recipientes.visita_id and v.brigadista_id = auth.uid()
    )
  );

create policy recipientes_delete on public.recipientes
  for delete to authenticated
  using (
    exists (
      select 1 from public.visitas v
      where v.id = recipientes.visita_id
        and (v.brigadista_id = auth.uid() or private.mi_rol() = 'jefe')
    )
  );

-- Jefe puede insertar sectores/cortes/cola (seed operativo); service role también
create policy sectores_insert_jefe on public.sectores
  for insert to authenticated
  with check (private.mi_rol() = 'jefe');

create policy cortes_insert_jefe on public.cortes
  for insert to authenticated
  with check (private.mi_rol() = 'jefe');

create policy cola_insert_jefe on public.cola_items
  for insert to authenticated
  with check (private.mi_rol() = 'jefe');

grant usage on schema public to anon, authenticated;
grant select on public.indices_sector to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
