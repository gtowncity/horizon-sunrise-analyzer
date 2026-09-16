import {BrowserCache} from './data/cache';
import {BavarianProvider,importGeoTIFF} from './data/provider';
import {analyze} from './core/engine';
import type {Inputs} from './core/types';
declare const __COMMIT__:string;
self.onmessage=async(e:MessageEvent<{inputs:Inputs}|{file:File;model:'dgm1'|'dom20'}>)=>{
  try{
    const cache=new BrowserCache();
    if('file' in e.data){const metadata=await importGeoTIFF(e.data.file,e.data.model,cache);self.postMessage({type:'imported',metadata});return;}
    const progress=(p:unknown)=>self.postMessage({type:'progress',progress:p});
    const provider=new BavarianProvider(cache,progress);
    const result=await analyze(provider,e.data.inputs,progress,__COMMIT__);
    self.postMessage({type:'result',result});
  }catch(error){self.postMessage({type:'error',message:error instanceof Error?error.message:'Unbekannter Analysefehler'});}
};
