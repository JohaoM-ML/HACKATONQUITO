/**
 * Capturas de ZANKU para la guía LaTeX del pitch.
 * Uso: node docs/scripts/capture-app.mjs
 * Requiere: app en http://localhost:3001 y Playwright instalado.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "docs", "figuras", "app");
const BASE = process.env.ZANKU_URL || "http://localhost:3001";

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name, opts = {}) {
  const file = path.join(OUT, `${name}.png`);
  await page.waitForTimeout(opts.wait ?? 800);
  await page.screenshot({
    path: file,
    fullPage: opts.fullPage ?? false,
  });
  console.log("ok", name);
}

async function loginDemo(page, puerta) {
  await page.goto(`${BASE}/${puerta}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const demo = page.getByRole("button", {
    name: puerta === "brigada" ? /demo de brigadista/i : /demo de jefe/i,
  });
  await demo.click();
  await page.waitForURL(
    puerta === "brigada" ? /\/ruta/ : /\/panel/,
    { timeout: 30000 }
  );
  await page.waitForTimeout(1200);
}

async function logout(page) {
  const salir = page.getByRole("button", { name: /salir/i });
  if (await salir.count()) {
    await salir.click();
    await page.waitForURL(/\/$/, { timeout: 15000 }).catch(() => {});
  }
  // Limpia sesión por si el botón no redirigió
  await page.context().clearCookies();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  const m = await mobile.newPage();
  const d = await desktop.newPage();

  // --- Portada ---
  await m.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(m, "00-portada");

  // --- Login brigadista ---
  await m.goto(`${BASE}/brigada`, { waitUntil: "networkidle" });
  await shot(m, "01-login-brigadista");

  // --- Campo ---
  await loginDemo(m, "brigada");
  await shot(m, "02-mis-zonas", { wait: 2000 });

  // Intentar abrir primera inspección
  const inspeccionar = m.locator('a[href*="/inspeccion/"]').first();
  if (await inspeccionar.count()) {
    await inspeccionar.click();
    await m.waitForURL(/\/inspeccion\//, { timeout: 15000 });
    await shot(m, "03-inspeccion-paso1", { wait: 1000 });

    // Paso 2: Hogar — avanzar si hay botón Siguiente
    const next = m.getByRole("button", { name: /siguiente|continuar|siguiente paso/i });
    const nextAlt = m.locator("button").filter({ hasText: /Siguiente|Continuar|→/ });
    if (await next.count()) {
      await next.first().click();
    } else if (await nextAlt.count()) {
      await nextAlt.first().click();
    } else {
      // Buscar chips de avance por número de paso en UI
      const paso2 = m.locator("text=2. Hogar").first();
      if (await paso2.count()) {
        // Click en botón inferior típico
        const btns = m.locator("button.btn-primary, button.btn-secondary");
        const n = await btns.count();
        for (let i = 0; i < n; i++) {
          const t = await btns.nth(i).innerText().catch(() => "");
          if (/siguiente|continuar|adelante/i.test(t)) {
            await btns.nth(i).click();
            break;
          }
        }
      }
    }
    await shot(m, "04-inspeccion-paso2", { wait: 800 });

    // Avanzar a recipientes
    const btns2 = m.locator("button");
    const n2 = await btns2.count();
    for (let i = 0; i < n2; i++) {
      const t = await btns2.nth(i).innerText().catch(() => "");
      if (/siguiente|continuar/i.test(t)) {
        await btns2.nth(i).click();
        break;
      }
    }
    await shot(m, "05-inspeccion-paso3", { wait: 800 });

    // Paso acción
    for (let i = 0; i < n2; i++) {
      const t = await btns2.nth(i).innerText().catch(() => "");
      if (/siguiente|continuar/i.test(t)) {
        await btns2.nth(i).click();
        break;
      }
    }
    await shot(m, "06-inspeccion-paso4", { wait: 800 });
  } else {
    console.warn("sin minizonas — capturas de inspección parciales (ruta vacía)");
    await shot(m, "03-inspeccion-paso1");
    await shot(m, "04-inspeccion-paso2");
    await shot(m, "05-inspeccion-paso3");
    await shot(m, "06-inspeccion-paso4");
  }

  await m.goto(`${BASE}/mis-registros`, { waitUntil: "networkidle" });
  await shot(m, "07-registros", { wait: 1000 });

  await m.goto(`${BASE}/perfil`, { waitUntil: "networkidle" });
  await shot(m, "08-perfil", { wait: 800 });

  await logout(m);

  // --- Login jefe ---
  await d.goto(`${BASE}/jefe`, { waitUntil: "networkidle" });
  await shot(d, "09-login-jefe");

  await loginDemo(d, "jefe");
  await shot(d, "10-panel-resumen", { wait: 2500, fullPage: true });

  await d.goto(`${BASE}/mapa`, { waitUntil: "networkidle" });
  await shot(d, "11-mapa", { wait: 3000 });

  await d.goto(`${BASE}/cola`, { waitUntil: "networkidle" });
  await shot(d, "12-cola", { wait: 1500 });

  await d.goto(`${BASE}/equipo`, { waitUntil: "networkidle" });
  await shot(d, "13-equipo", { wait: 1500 });

  await d.goto(`${BASE}/avisos`, { waitUntil: "networkidle" });
  await shot(d, "14-alertas", { wait: 1500 });

  // WhatsApp mockup (local static)
  const mock = path.join(ROOT, "web", "public", "mockup-whatsapp.html");
  if (fs.existsSync(mock)) {
    const mw = await mobile.newPage();
    await mw.goto(`file://${mock.replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });
    await shot(mw, "15-whatsapp-mockup", { wait: 1000 });
    await mw.close();
  }

  // También intentar puerto 8765 si el mockup está servido
  try {
    const mw2 = await mobile.newPage();
    const res = await mw2.goto("http://localhost:8765/mockup-whatsapp.html", {
      waitUntil: "networkidle",
      timeout: 5000,
    });
    if (res && res.ok()) {
      await shot(mw2, "15-whatsapp-mockup", { wait: 800 });
    }
    await mw2.close();
  } catch {
    /* opcional */
  }

  await browser.close();
  console.log("Capturas en", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

