/**
 * Seed: cubre el casco urbano de Guayaquil con el panal H3 (res 8, ~800 m)
 * y asigna cada celda al sector más cercano.
 *
 * Uso (desde web/):
 *   npx tsx scripts/seed-minizonas.ts
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { SECTORES_GUAYAQUIL } from "../lib/geo/guayaquil";
import { mallaDeGuayaquil, META_VIVIENDAS_MINIZONA } from "../lib/geo/minizonas";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const s of SECTORES_GUAYAQUIL) {
    const { error } = await supabase.from("sectores").upsert(
      {
        slug: s.slug,
        nombre: s.nombre,
        zona: s.zona,
        lat: s.lat,
        lon: s.lon,
        radio_m: 4000,
      },
      { onConflict: "slug" }
    );
    if (error) {
      console.error(`sector ${s.slug}: ${error.message}`);
      process.exit(1);
    }
  }

  const { data: sectores, error: sErr } = await supabase.from("sectores").select("id, slug");
  if (sErr) throw sErr;
  const idPorSlug = new Map((sectores || []).map((s) => [s.slug, s.id]));

  await supabase.from("visitas").update({ minizona_id: null }).not("minizona_id", "is", null);
  await supabase.from("minizonas").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const filas = mallaDeGuayaquil()
    .map((c) => {
      const sector_id = idPorSlug.get(c.slug);
      if (!sector_id) return null;
      return {
        sector_id,
        h3: c.h3,
        lat: c.lat,
        lon: c.lon,
        origen: "malla" as const,
        meta_viviendas: META_VIVIENDAS_MINIZONA,
      };
    })
    .filter((f): f is NonNullable<typeof f> => !!f);

  const { error } = await supabase.from("minizonas").insert(filas);
  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const porSector = new Map<string, number>();
  for (const f of filas) {
    const slug = [...idPorSlug.entries()].find(([, id]) => id === f.sector_id)?.[0] || "?";
    porSector.set(slug, (porSector.get(slug) || 0) + 1);
  }

  console.log(`Listo. ${filas.length} minizonas sobre Guayaquil urbano.`);
  for (const [slug, n] of [...porSector.entries()].sort()) {
    console.log(`  ${slug}: ${n}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
