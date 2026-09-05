import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const INSPECCION =
  "/inspeccion/c56e72d2-4679-4255-99af-21f9a1ad6324?minizona=cd955352-c241-469c-b675-5c55f568bb92";

const browser = await chromium.launch({
  headless: false,
  channel: "msedge",
  args: ["--start-maximized"],
});
const page = await browser.newPage({ viewport: null });

await page.goto(`${BASE}/brigada`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.getByRole("button", { name: /demo de brigadista/i }).click();
await page.waitForURL(/\/ruta/, { timeout: 25000 });
await page.goto(`${BASE}${INSPECCION}`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.getByRole("button", { name: "Siguiente" }).click();
await page.getByText("Nº habitantes", { exact: false }).waitFor();
await page.getByRole("button", { name: "Siguiente" }).click();
await page.getByText("Recipiente 1/", { exact: false }).waitFor();
await page.getByRole("button", { name: "Larvicida" }).click();
await page.getByRole("button", { name: "Siguiente" }).click();
await page.getByText("Acciones en este hogar").waitFor();

console.log("Checklist abierto. Dejá la ventana abierta para revisarlo.");
await new Promise(() => {});
