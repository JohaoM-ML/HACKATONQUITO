import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Página pública: cualquiera con el enlace /aviso puede ver el mockup. */
export async function GET() {
  const file = join(process.cwd(), "public", "mockup-whatsapp.html");
  const html = await readFile(file, "utf8");
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
