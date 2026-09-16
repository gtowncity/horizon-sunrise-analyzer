import type {Analysis} from './types';
import {validateInputs} from './engine';
export function exportJSON(analysis:Analysis){return JSON.stringify(analysis,null,2);}
export function importJSON(text:string):Analysis {
  if(text.length>100*1024*1024)throw new Error('Analyse-Datei zu groß');
  const a=JSON.parse(text) as Analysis;
  if(a.schema!=='hsa-1'||!a.inputs||!a.profile||!Array.isArray(a.profile.samples)||!Array.isArray(a.tiles)||!Array.isArray(a.horizon)||!Array.isArray(a.warnings))throw new Error('Ungültiger Analyseexport');
  validateInputs(a.inputs);
  for(const s of a.profile.samples)if(![s.lat,s.lon,s.distance,s.terrain,s.angle].every(Number.isFinite))throw new Error('Ungültige Profilwerte');
  if(!a.profile.blocker||!Number.isFinite(a.profile.blocker.angle))throw new Error('Ungültiger Horizontpunkt');
  return a;
}
export function exportCSV(a:Analysis){
  const rows=[['distance_m','latitude_deg','longitude_deg','terrain_m_NHN','surface_m_NHN','surface_excess_m','terrain_angle_deg','surface_angle_deg','curvature_drop_m','tile_id']];
  for(const s of a.profile.samples)rows.push([s.distance,s.lat,s.lon,s.terrain,s.surface??'',s.excess??'',s.angle,s.surfaceAngle??'',s.drop,s.tile].map(String));
  return rows.map(r=>r.map(v=>`"${v.replaceAll('"','""')}"`).join(',')).join('\r\n');
}
