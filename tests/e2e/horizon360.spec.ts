import { test, expect } from "@playwright/test";
import { zipSync } from "fflate";
import { fixtureTIFF } from "../fixtures";

test("360 navigation, worker, synchronized selection, JSON, CSV and provisional NINA", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.route(
    "https://geoservices.bayern.de/services/poly2metalink/zip/start/**",
    async (route) => {
      const match = route
        .request()
        .postData()!
        .match(/\(\((\d+) (\d+)/)!;
      const id = `${Math.floor(Number(match[1]) / 1000)}_${Math.floor(Number(match[2]) / 1000)}`;
      await route.fulfill({
        json: {
          status: "FINISHED_OK",
          url: `https://geodaten.bayern.de/odd_zip/ASTRO360_FIXTURE/${id}.zip`,
        },
      });
    },
  );
  await context.route(
    "https://geodaten.bayern.de/odd_zip/ASTRO360_FIXTURE/**",
    async (route) => {
      const id = route.request().url().split("/").at(-1)!.replace(".zip", "");
      await route.fulfill({
        body: Buffer.from(
          zipSync({ [`${id}.tif`]: new Uint8Array(fixtureTIFF(id)) }),
        ),
        contentType: "application/zip",
      });
    },
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "360°-Horizont", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "360°-Horizont", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Breite ° N", { exact: true }).fill("48.2");
  await page.getByLabel("Länge ° E", { exact: true }).fill("11.6");
  await page.getByLabel("Gelände-Reichweite · m", { exact: true }).fill("100");
  await page.getByLabel("DOM-Nahbereich · m", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "360° berechnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Höhe über Azimut · 360°" }),
  ).toBeVisible();
  await page
    .getByRole("spinbutton", { name: "Ausgewählter Azimut · °" })
    .fill("90");
  await expect(
    page.getByRole("heading", { name: "Ausgewählte Richtung" }),
  ).toBeVisible();
  await expect(page.getByText(/90.000° ·/)).toBeVisible();
  for (const name of ["360° JSON exportieren", "360° CSV exportieren"]) {
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(
      /astro360-scientific\.(json|csv)/,
    );
  }
  await expect(
    page.getByRole("button", {
      name: "N.I.N.A. physisch · VORLÄUFIG",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "N.I.N.A. physisch · VORLÄUFIG", exact: true })
    .click();
  expect((await download).suggestedFilename()).toContain("PROVISIONAL");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({
    path: `_local_audit/screenshots/astro360-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Sichtlinie", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sichtlinie & Horizont" }),
  ).toBeVisible();
});
test("360 invalid input and cancellation", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "360°-Horizont", exact: true })
    .click();
  await page.getByLabel("Breite ° N", { exact: true }).fill("0");
  await page
    .getByRole("button", { name: "360° berechnen", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Standort");
  await page.getByLabel("Breite ° N", { exact: true }).fill("48.2");
  await page
    .getByRole("button", { name: "360° berechnen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "360° abbrechen", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("abgebrochen");
});
