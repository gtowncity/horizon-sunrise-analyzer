/** Opt-in real browser network test, public Olympiapark only. No mocked data. */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const output = resolve(
  process.env.ASTRO_AUDIT_EVIDENCE ?? "../astro-audit-evidence",
);
mkdirSync(output, { recursive: true });
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "127.0.0.1",
    "--port",
    "4174",
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let browser;
try {
  await new Promise((resolveReady, reject) => {
    server.once("error", reject);
    server.stdout.on("data", (b) => {
      if (b.toString().includes("4174")) resolveReady();
    });
    server.once("exit", (code) => {
      if (code) reject(new Error("Preview exited " + code));
    });
  });
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4174/");
  await page
    .getByRole("button", { name: "360°-Horizont", exact: true })
    .click();
  await page.getByLabel("Breite ° N", { exact: true }).fill("48.1731");
  await page.getByLabel("Länge ° E", { exact: true }).fill("11.5467");
  await page.getByLabel("Gelände-Reichweite · m", { exact: true }).fill("100");
  await page.getByLabel("DOM-Nahbereich · m", { exact: true }).fill("10");
  await page
    .getByText("Modelle, Unsicherheit und Ressourcen", { exact: true })
    .click();
  await page.getByLabel("Maximale Strahlen", { exact: true }).fill("12");
  await page.getByLabel("Start-Azimutschritt · °", { exact: true }).fill("30");
  const start = Date.now();
  await page
    .getByRole("button", { name: "360° berechnen", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Höhe über Azimut · 360°" })
    .waitFor();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "360° JSON exportieren", exact: true })
    .click();
  const file = await downloaded,
    result = JSON.parse(readFileSync(await file.path()));
  const completeRequests = result.directions.every(
    (d) => d.terrain.valid > 0 && d.surface.valid > 0,
  );
  const report = {
    classification:
      completeRequests && errors.length === 0 ? "PASS_WITH_KNOWN_GAPS" : "FAIL",
    scope:
      "Real Chromium CORS, official public Olympiapark DGM/DOM, 100 m / 10 m, twelve rays; not physical accuracy",
    browser: browser.version(),
    wallMs: Date.now() - start,
    pageErrors: errors,
    result,
  };
  writeFileSync(
    resolve(output, "browser-real.json"),
    JSON.stringify(report, null, 2),
  );
  await page.screenshot({
    path: resolve(output, "browser-real-public.png"),
    fullPage: true,
  });
  console.log(
    JSON.stringify({
      classification: report.classification,
      browser: report.browser,
      wallMs: report.wallMs,
      tiles: result.tiles.length,
    }),
  );
  if (report.classification === "FAIL") process.exitCode = 1;
} catch (error) {
  writeFileSync(
    resolve(output, "browser-real.json"),
    JSON.stringify({ classification: "FAIL", error: error.message }, null, 2),
  );
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
