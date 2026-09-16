import {test,expect} from '@playwright/test';
import {zipSync} from 'fflate';
import {fixtureTIFF} from '../fixtures';
test('complete deterministic sightline, sunrise, export and responsive workflow',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('https://geoservices.bayern.de/services/poly2metalink/zip/start/**',async route=>{
    const body=route.request().postData()!,match=body.match(/\(\((\d+) (\d+)/)!;
    const id=`${Math.floor(Number(match[1])/1000)}_${Math.floor(Number(match[2])/1000)}`;
    await route.fulfill({json:{status:'FINISHED_OK',url:`https://geodaten.bayern.de/odd_zip/TEST_FIXTURE/${id}.zip`}});
  });
  await context.route('https://geodaten.bayern.de/odd_zip/TEST_FIXTURE/**',async route=>{
    const id=route.request().url().split('/').at(-1)!.replace('.zip','');
    await route.fulfill({body:Buffer.from(zipSync({[`${id}.tif`]:new Uint8Array(fixtureTIFF(id))})),contentType:'application/zip'});
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Sichtlinie & Horizont'})).toBeVisible();
  await page.getByLabel('Breite ° N',{exact:true}).fill('48.2');
  await page.getByLabel('Länge ° E',{exact:true}).fill('11.6');
  await page.getByLabel('Azimut · ° von Nord').fill('87');
  await page.getByLabel('Maximale Entfernung · km').fill('0.2');
  await page.getByRole('button',{name:'Analyse starten'}).click();
  await expect(page.getByRole('heading',{name:'Gelände in der Sichtlinie'})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'JSON exportieren'}).click();expect((await download).suggestedFilename()).toBe('horizon-analysis.json');
  await page.getByRole('button',{name:'Sonnenaufgang',exact:true}).click();
  await page.getByLabel('Datum',{exact:true}).fill('2026-09-20');
  await page.getByText('Atmosphäre & Genauigkeit',{exact:true}).click();
  await page.getByLabel('Azimutschritt · °').fill('0.5');
  await page.getByRole('button',{name:'Analyse starten'}).click();
  await expect(page.getByRole('heading',{name:'Horizontfunktion H(A)'})).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({path:`_local_audit/screenshots/e2e-${test.info().project.name}.png`,fullPage:true});
});
test('invalid input and cancellation have clear states',async({page})=>{
  await page.goto('/');await page.getByLabel('Breite ° N',{exact:true}).fill('0');await page.getByRole('button',{name:'Analyse starten'}).click();await expect(page.getByRole('alert')).toContainText('Standort');
  await page.getByLabel('Breite ° N',{exact:true}).fill('48.2');await page.getByRole('button',{name:'Analyse starten'}).click();await page.getByRole('button',{name:'Analyse abbrechen'}).click();await expect(page.getByRole('alert')).toContainText('abgebrochen');
});
