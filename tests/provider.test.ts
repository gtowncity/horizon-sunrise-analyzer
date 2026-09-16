import {describe,it,expect} from 'vitest';
import 'fake-indexeddb/auto';
import {BrowserCache,MemoryCache} from '../src/data/cache';
import {BavarianProvider,decodeTile} from '../src/data/provider';
import {fixtureTIFF} from './fixtures';
import type {TileRecord,Model} from '../src/core/types';
const metadata=(id:string,model:Model='dgm1'):TileRecord=>({id,model,source:'TEST / FIXTURE',state:'Local',bytes:0,downloadedAt:'2026-01-01T00:00:00Z'});
describe('actual GeoTIFF decoding and cache',()=>{
  it('decodes an analytical plane and validates grid metadata',async()=>{const data=fixtureTIFF('600_5400');const tile=await decodeTile({data,metadata:metadata('600_5400')});expect(tile.record.crs).toBe(25832);expect(tile.resolution).toBe(1);expect(tile.values[0]).toBeCloseTo(301.9995,4);});
  it('rejects TIFF location mismatch',async()=>{await expect(decodeTile({data:fixtureTIFF('600_5400'),metadata:metadata('601_5400')})).rejects.toThrow('Kachel-ID');});
  it('bilinear interpolation crosses a tile boundary without clamping',async()=>{
    const cache=new MemoryCache();
    // Second tile plane is elevated one metre to remain continuous in easting.
    for(const id of ['600_5400','601_5400'])await cache.put('dgm1:'+id,{data:fixtureTIFF(id,1,id.startsWith('601')?301:300),metadata:metadata(id)});
    const p=new BavarianProvider(cache,()=>{},async()=>{throw new Error('Unexpected download');});
    const h=await p.sampleMany([[600999.75,5400500],[601000.25,5400500]],'dgm1');
    expect(h[0]).toBeCloseTo(301.99975,4);expect(h[1]).toBeCloseTo(302.00025,4);
  });
  it('IndexedDB retains binary data and provenance, then clears',async()=>{const cache=new BrowserCache();await cache.clear();await cache.put('test',{data:new Uint8Array([1,2,3]).buffer,metadata:metadata('600_5400')});const r=await cache.get('test');expect(Array.from(new Uint8Array(r!.data))).toEqual([1,2,3]);expect(r!.metadata.source).toBe('TEST / FIXTURE');await cache.clear();expect(await cache.get('test')).toBeUndefined();});
});
