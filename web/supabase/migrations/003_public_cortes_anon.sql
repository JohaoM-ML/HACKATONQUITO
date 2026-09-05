-- Lectura pública de cortes y cola Regla A (anuncios Interagua / cola operativa).
-- Usado por GET /api/public/cortes para n8n + WhatsApp vecinos.
-- No expone visitas, recipientes ni perfiles.

create policy cortes_select_anon on public.cortes
  for select to anon using (true);

create policy cola_select_anon on public.cola_items
  for select to anon using (true);

create policy sectores_select_anon on public.sectores
  for select to anon using (true);

grant select on public.cortes to anon;
grant select on public.cola_items to anon;
grant select on public.sectores to anon;
