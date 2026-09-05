-- Falta la policy de UPDATE en sectores: el jefe podía "generar" una malla (lat/lon/radio_m)
-- pero el UPDATE quedaba bloqueado por RLS (solo existían policies de SELECT e INSERT),
-- así que la ubicación nunca se guardaba de verdad. La necesita el flujo de generación
-- automática de cobertura (POST /api/minizonas/generar) para fijar el centro resuelto
-- (geocodificado o de sectores/CENTROS_PUBLICOS) y el radio que decide el puntaje.

create policy sectores_update_jefe on public.sectores
  for update to authenticated
  using (private.mi_rol() = 'jefe')
  with check (private.mi_rol() = 'jefe');
