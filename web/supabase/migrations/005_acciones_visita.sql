-- Acciones ejecutadas en el predio (nivel visita). Permite comparar, en
-- reinspecciones, qué paquete de intervención deja menos criaderos.
-- Catálogo fijo: eliminar_tapar | larvicida | malla | entrenar_hogar | entregar_material

alter table public.visitas
  add column if not exists acciones text[] not null default '{}';

alter table public.visitas
  drop constraint if exists visitas_acciones_catalogo;

alter table public.visitas
  add constraint visitas_acciones_catalogo
  check (
    acciones <@ array[
      'eliminar_tapar',
      'larvicida',
      'malla',
      'entrenar_hogar',
      'entregar_material'
    ]::text[]
  );

comment on column public.visitas.acciones is
  'Checklist de campo: intervenciones hechas en esa vivienda/minizona. Covariable para comparar reinfestación.';

create index if not exists visitas_acciones_gin on public.visitas using gin (acciones);

-- Recupera lo que ya estaba en columnas viejas y en el tratamiento por recipiente.
update public.visitas v
set acciones = coalesce((
  select array_agg(distinct x.accion)
  from (
    select unnest(array_remove(array[
      case when v.se_educo_hogar then 'entrenar_hogar' else null end,
      case when v.material_entregado then 'entregar_material' else null end
    ], null)) as accion
    union
    select case
      when r.tratado = 'larvicida' then 'larvicida'
      when r.tratado in ('eliminado', 'tapado') then 'eliminar_tapar'
      else null
    end
    from public.recipientes r
    where r.visita_id = v.id
  ) x
  where x.accion is not null
), '{}')
where coalesce(cardinality(v.acciones), 0) = 0;
