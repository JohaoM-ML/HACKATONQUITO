import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../../docs/figuras/app");
const BASE = "http://localhost:3001";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(`${BASE}/brigada`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /demo de brigadista/i }).click();
await page.waitForURL(/\/ruta/, { timeout: 30000 });
await page.waitForTimeout(1500);
const link = page.locator('a[href*="/inspeccion/"]').first();
if (!(await link.count())) throw new Error("no inspeccion");
await link.click();
await page.waitForURL(/\/inspeccion\//);
await page.waitForTimeout(800);
for (let i = 0; i < 3; i++) {
  await page.getByRole("button", { name: /^Siguiente$/ }).click();
  await page.waitForTimeout(800);
}
await page.screenshot({ path: path.join(OUT, "06-inspeccion-paso4.png") });
console.log("paso4 ok");
await browser.close();
