/** Opt-in genuine browser CORS/performance experiment; public sites only. */
import { chromium, devices } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
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
    "4175",
    "--strictPort",
  ],
  { stdio: "pipe", windowsHide: true },
);
let browser;
const results = [];
const sites = [
  {
    name: "Olympiapark public reference",
    lat: 48.1731,
    lon: 11.5467,
    mobile: false,
  },
  {
    name: "Bamberg public reference",
    lat: 49.8917,
    lon: 10.8918,
    mobile: true,
  },
];
try {
  await new Promise((ready, reject) => {
    server.once("error", reject);
    server.stdout.on("data", (b) => {
      if (b.toString().includes("4175")) ready();
    });
    server.once("exit", (c) => reject(new Error("Preview exit " + c)));
  });
  browser = await chromium.launch({ headless: true });
  for (const site of sites) {
    const context = await browser.newContext(
      site.mobile
        ? { ...devices["Pixel 7"] }
        : { viewport: { width: 1280, height: 900 } },
    );
    const page = await context.newPage();
    page.setDefaultTimeout(180000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4175/");
    await page
      .getByRole("button", { name: "360°-Horizont", exact: true })
      .click();
    await page
      .getByLabel("Rechenmodus", { exact: true })
      .selectOption("DETAIL");
    await page.getByLabel("Breite ° N", { exact: true }).fill(String(site.lat));
    await page.getByLabel("Länge ° E", { exact: true }).fill(String(site.lon));
    await page
      .getByLabel("Gelände-Reichweite · m", { exact: true })
      .fill("100");
    await page.getByLabel("DOM-Nahbereich · m", { exact: true }).fill("10");
    await page
      .getByText("Modelle, Unsicherheit und Ressourcen", { exact: true })
      .click();
    for (const [name, value] of [
      ["Maximale Strahlen", 12],
      ["Start-Azimutschritt · °", 30],
      ["Radialschritt · m", 10],
      ["Angegebene Positionsunsicherheit · m", 1],
      ["Optikbewegung horizontaler Radius · m", 0.3],
      ["Angegebenes vertikales Budget · m", 0.1],
      ["Optikbewegung nach unten · m", 0.2],
      ["Optikbewegung nach oben · m", 0.2],
      ["Angenommene DGM-Höhenfehlergrenze · m", 0.2],
      ["Angenommene DOM-Höhenfehlergrenze · m", 0.6],
    ])
      await page.getByLabel(name, { exact: true }).fill(String(value));
    for (const cacheState of ["cold", "warm", "cell-budget-stress"]) {
      if (cacheState === "cell-budget-stress")
        await page
          .getByLabel("Maximale native Rasterzellen", { exact: true })
          .fill("1000");
      const start = Date.now();
      await page
        .getByRole("button", { name: "360° berechnen", exact: true })
        .click();
      await page
        .getByRole("heading", {
          name: "Rasterzellprüfung und Unsicherheitsintervalle",
        })
        .waitFor();
      const download = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "360° JSON exportieren", exact: true })
        .click();
      const result = JSON.parse(readFileSync(await (await download).path()));
      if (
        result.schema !== "astro360-3" ||
        result.spatialAudit?.terrain?.reconstruction !==
          "BILINEAR_SUPPORT_MAX_ENVELOPE" ||
        !/^[a-f0-9]{64}$/.test(result.algorithm ?? "")
      )
        throw new Error("Stale or unidentified scientific worker build");
      const validRays =
        result.directions.length === 12 &&
        result.directions.every(
          (d) =>
            d.terrain.errors.length === 0 &&
            d.surface.errors.length === 0 &&
            d.terrain.sampledTo === 100 &&
            d.surface.sampledTo === 10,
        );
      const audit = result.spatialAudit,
        modelCoverage =
          cacheState === "cell-budget-stress"
            ? !audit?.terrain?.completeTraversal &&
              audit?.terrain?.sectors.every((s) => s.modelUpper === null)
            : audit?.terrain?.completeTraversal &&
              audit?.surface?.completeTraversal;
      const record = {
        site,
        cacheState,
        classification:
          validRays && modelCoverage && errors.length === 0
            ? "PASS_WITH_KNOWN_GAPS"
            : "FAIL",
        browser: browser.version(),
        wallMs: Date.now() - start,
        pageErrors: [...errors],
        heap: await page.evaluate(() => ({
          scope: "main page JS only, excludes workers",
          ...(performance.memory
            ? { usedJSHeapBytes: performance.memory.usedJSHeapSize }
            : { unavailable: true }),
        })),
        result,
      };
      results.push(record);
      writeFileSync(
        resolve(output, "browser-multisite.json"),
        JSON.stringify(
          {
            sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
              encoding: "utf8",
            }).trim(),
            sites: results,
            scope:
              "two public browser sites; declared interval assumptions; not on-site validation or geodesic certification",
          },
          null,
          2,
        ),
      );
      console.log(
        JSON.stringify({
          site: site.name,
          cacheState,
          classification: record.classification,
          wallMs: record.wallMs,
          cells: audit?.terrain?.evaluatedCells,
          downloads: result.performance?.downloads,
        }),
      );
      if (record.classification === "FAIL") process.exitCode = 1;
      if (cacheState === "warm")
        await page.screenshot({
          path: resolve(
            output,
            `round2-${site.mobile ? "mobile" : "desktop"}-real.png`,
          ),
          fullPage: true,
        });
    }
    await context.close();
  }
} catch (error) {
  results.push({ classification: "FAIL", error: error.message });
  writeFileSync(
    resolve(output, "browser-multisite.json"),
    JSON.stringify({ sites: results }, null, 2),
  );
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
