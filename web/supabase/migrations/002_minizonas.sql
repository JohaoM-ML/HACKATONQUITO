-- VENTANA SECA — minizonas (muestreo por conglomerados) + cerco perifocal
--
-- Por qué existe esta tabla:
-- Aedes aegypti rara vez se dispersa más de ~100 m desde donde emerge, así que un
-- índice entomológico promediado sobre un sector entero (varios km) diluye los focos.
-- La minizona es una celda H3 de resolución 10 (~160 m de ancho en Guayaquil), es decir
-- la escala a la que el mosquito realmente opera. El cerco perifocal (celda + sus 6
-- vecinas) cubre un radio de ~225 m alrededor del foco, dentro de la banda de bloqueo
-- de 200–300 m que usan los protocolos de control ante un caso. El índice H3 se calcula
-- en la app (lib/geo/minizonas.ts), no en Postgres, para no depender de la extensión h3-pg.

alter table public.sectores
  add column if not exists radio_m int;

create table public.minizonas (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.sectores(id) on delete cascade,
  h3 text not null unique,
  lat double precision not null,
  lon double precision not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'cubierta')),
  -- 'malla': generada al delimitar el sector. 'cerco': abierta por un foco vecino.
  origen text not null default 'malla' check (origen in ('malla', 'cerco')),
  foco_visita_id uuid,
  meta_viviendas int not null default 5,
  created_at timestamptz not null default now()
);

create index minizonas_sector_idx on public.minizonas (sector_id, estado);

alter table public.visitas
  add column if not exists minizona_id uuid references public.minizonas(id) on delete set null,
  add column if not exists h3 text;

alter table public.minizonas
  add constraint minizonas_foco_fk
  foreign key (foco_visita_id) references public.visitas(id) on delete set null;

create index visitas_minizona_idx on public.visitas (minizona_id, fecha_hora desc);

create table public.asignaciones_minizona (
  id uuid primary key default gen_random_uuid(),
  minizona_id uuid not null references public.minizonas(id) on delete cascade,
  brigadista_id uuid not null references public.perfiles(id) on delete cascade,
  orden int,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_curso', 'completada')),
  asignado_en timestamptz not null default now(),
  unique (minizona_id, brigadista_id)
);

create index asig_mini_brigadista_idx on public.asignaciones_minizona (brigadista_id, estado, orden);

-- ---------------------------------------------------------------------------
-- Trigger: una minizona pasa a 'cubierta' cuando alcanza su meta de viviendas
-- inspeccionadas. Es la definición operativa de "perímetro cubierto".
-- ---------------------------------------------------------------------------

create or replace function public.refresh_minizona_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
  v_meta int;
begin
  if new.minizona_id is null then
    return new;
  end if;

  select count(*) into v_n
  from public.visitas
  where minizona_id = new.minizona_id
    and estado_visita = 'inspeccionada';

  select meta_viviendas into v_meta
  from public.minizonas
  where id = new.minizona_id;

  update public.minizonas
  set estado = case
        when v_n >= coalesce(v_meta, 5) then 'cubierta'
        when v_n > 0 then 'en_curso'
        else 'pendiente'
      end
  where id = new.minizona_id;

  return new;
end;
$$;

drop trigger if exists visitas_refresh_minizona on public.visitas;
create trigger visitas_refresh_minizona
  after insert or update of minizona_id, estado_visita on public.visitas
  for each row execute function public.refresh_minizona_estado();

-- PostgREST expone cualquier función del schema public como RPC. Las de trigger no
-- deben ser invocables directamente, menos siendo security definer.
revoke execute on function public.refresh_minizona_estado() from anon, authenticated, public;
revoke execute on function public.refresh_sector_coords() from anon, authenticated, public;
revoke execute on function public.handle_new_user() from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- Vista: índices Stegomyia por minizona y semana (misma fórmula que indices_sector,
-- pero a la escala de vuelo del vector). HI 4 | CI 3 | BI 5 (OPS).
-- ---------------------------------------------------------------------------

create or replace view public.indices_minizona
with (security_invoker = true)
as
with base as (
  select
    v.minizona_id,
    date_trunc('week', v.fecha_hora)::date as semana,
    v.id as visita_id,
    v.estado_visita,
    exists (
      select 1 from public.recipientes r
      where r.visita_id = v.id
        and (r.positivo_larvas is true or r.positivo_pupas is true)
    ) as vivienda_positiva
  from public.visitas v
  where v.minizona_id is not null
),
agg_visitas as (
  select
    minizona_id,
    semana,
    count(*) filter (where estado_visita = 'inspeccionada') as viviendas_inspeccionadas,
    count(*) filter (where estado_visita = 'inspeccionada' and vivienda_positiva) as viviendas_positivas
  from base
  group by minizona_id, semana
),
agg_recip as (
  select
    v.minizona_id,
    date_trunc('week', v.fecha_hora)::date as semana,
    count(r.*) filter (where v.estado_visita = 'inspeccionada') as recipientes_inspeccionados,
    count(r.*) filter (
      where v.estado_visita = 'inspeccionada'
        and (r.positivo_larvas is true or r.positivo_pupas is true)
    ) as recipientes_positivos
  from public.visitas v
  left join public.recipientes r on r.visita_id = v.id
  where v.minizona_id is not null
  group by v.minizona_id, date_trunc('week', v.fecha_hora)::date
)
select
  m.id as minizona_id,
  m.h3,
  m.sector_id,
  s.nombre as sector_nombre,
  m.lat,
  m.lon,
  m.estado,
  m.origen,
  a.semana,
  a.viviendas_inspeccionadas,
  a.viviendas_positivas,
  coalesce(r.recipientes_inspeccionados, 0) as recipientes_inspeccionados,
  coalesce(r.recipientes_positivos, 0) as recipientes_positivos,
  case when a.viviendas_inspeccionadas > 0
    then round(100.0 * a.viviendas_positivas / a.viviendas_inspeccionadas, 2)
    else null end as hi,
  case when coalesce(r.recipientes_inspeccionados, 0) > 0
    then round(100.0 * r.recipientes_positivos / r.recipientes_inspeccionados, 2)
    else null end as ci,
  case when a.viviendas_inspeccionadas > 0
    then round(100.0 * coalesce(r.recipientes_positivos, 0) / a.viviendas_inspeccionadas, 2)
    else null end as bi
from agg_visitas a
join public.minizonas m on m.id = a.minizona_id
join public.sectores s on s.id = m.sector_id
left join agg_recip r on r.minizona_id = a.minizona_id and r.semana = a.semana;

-- ---------------------------------------------------------------------------
-- Vista: cobertura por sector. Este es el KPI honesto del proyecto — mide
-- cuánto territorio se recorrió, no reducción de transmisión (no hay datos de casos).
-- ---------------------------------------------------------------------------

create or replace view public.cobertura_sector
with (security_invoker = true)
as
select
  s.id as sector_id,
  s.nombre as sector_nombre,
  s.zona,
  s.lat,
  s.lon,
  s.radio_m,
  count(m.*) as minizonas_total,
  count(m.*) filter (where m.estado = 'cubierta') as minizonas_cubiertas,
  count(m.*) filter (where m.estado = 'en_curso') as minizonas_en_curso,
  count(m.*) filter (where m.origen = 'cerco') as minizonas_cerco,
  count(m.*) filter (where m.origen = 'cerco' and m.estado = 'cubierta') as cercos_cerrados,
  case when count(m.*) > 0
    then round(100.0 * count(m.*) filter (where m.estado = 'cubierta') / count(m.*), 1)
    else null end as pct_cobertura,
  case when count(m.*) filter (where m.origen = 'cerco') > 0
    then round(
      100.0 * count(m.*) filter (where m.origen = 'cerco' and m.estado = 'cubierta')
      / count(m.*) filter (where m.origen = 'cerco'), 1)
    else null end as pct_cercos_cerrados
from public.sectores s
left join public.minizonas m on m.sector_id = s.id
group by s.id, s.nombre, s.zona, s.lat, s.lon, s.radio_m;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.minizonas enable row level security;
alter table public.asignaciones_minizona enable row level security;

create policy minizonas_select_auth on public.minizonas
  for select to authenticated using (true);

-- El brigadista puede abrir minizonas de cerco al encontrar un foco; la malla la
-- genera el jefe al delimitar el sector.
create policy minizonas_insert on public.minizonas
  for insert to authenticated
  with check (private.mi_rol() = 'jefe' or origen = 'cerco');

create policy minizonas_update on public.minizonas
  for update to authenticated
  using (private.mi_rol() = 'jefe')
  with check (private.mi_rol() = 'jefe');

create policy minizonas_delete_jefe on public.minizonas
  for delete to authenticated
  using (private.mi_rol() = 'jefe');

create policy asig_mini_select on public.asignaciones_minizona
  for select to authenticated
  using (
    brigadista_id = auth.uid()
    or exists (
      select 1 from public.perfiles p
      where p.id = asignaciones_minizona.brigadista_id
        and p.brigada_id = private.mi_brigada_id()
        and private.mi_rol() = 'jefe'
    )
  );

create policy asig_mini_insert_jefe on public.asignaciones_minizona
  for insert to authenticated
  with check (private.mi_rol() = 'jefe');

create policy asig_mini_update on public.asignaciones_minizona
  for update to authenticated
  using (brigadista_id = auth.uid() or private.mi_rol() = 'jefe')
  with check (brigadista_id = auth.uid() or private.mi_rol() = 'jefe');

create policy asig_mini_delete_jefe on public.asignaciones_minizona
  for delete to authenticated
  using (private.mi_rol() = 'jefe');

grant select on public.indices_minizona to authenticated;
grant select on public.cobertura_sector to authenticated;
grant select, insert, update, delete on public.minizonas to authenticated;
grant select, insert, update, delete on public.asignaciones_minizona to authenticated;
