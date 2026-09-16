import {openDB} from 'idb';
import type {TileRecord} from '../core/types';
export type CacheEntry = {data: ArrayBuffer; metadata: TileRecord};
export interface TileCache {get(key:string): Promise<CacheEntry|undefined>;put(key:string,entry:CacheEntry):Promise<void>;clear():Promise<void>;}
export class BrowserCache implements TileCache {
  private db = openDB('horizon-elevation-v1',1,{upgrade(db){db.createObjectStore('tiles');}});
  async get(key:string){return (await this.db).get('tiles',key) as Promise<CacheEntry|undefined>;}
  async put(key:string,value:CacheEntry){await (await this.db).put('tiles',value,key);}
  async clear(){await (await this.db).clear('tiles');}
}
export class MemoryCache implements TileCache {
  values=new Map<string,CacheEntry>();
  async get(key:string){return this.values.get(key);}
  async put(key:string,value:CacheEntry){this.values.set(key,value);}
  async clear(){this.values.clear();}
}
