import proj4 from 'proj4';
import geo from 'geographiclib-geodesic';
import type { Position } from './types';
export const RAD = Math.PI / 180;
export const UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
export function toUTM(p: Position): [number, number] { return proj4('EPSG:4326', UTM32, [p.lon, p.lat]) as [number,number]; }
export function fromUTM(x: number, y: number): Position { const [lon, lat] = proj4(UTM32, 'EPSG:4326', [x,y]); return {lat,lon}; }
export function normalizeAzimuth(a: number) { return ((a % 360) + 360) % 360; }
export function destination(p: Position, azimuth: number, distance: number): Position {
  const r = geo.Geodesic.WGS84.Direct(p.lat, p.lon, azimuth, distance);
  return {lat: r.lat2!, lon: r.lon2!};
}
export function inverse(a: Position, b: Position) {
  const r = geo.Geodesic.WGS84.Inverse(a.lat,a.lon,b.lat,b.lon);
  return {distance: r.s12!, azimuth: normalizeAzimuth(r.azi1!)};
}
export function tileId(x: number,y: number) { return `${Math.floor(x/1000)}_${Math.floor(y/1000)}`; }
export function tileOrigin(id: string) { if(!/^\d{3}_\d{4}$/.test(id)) throw new Error('Ungültige Kachel-ID'); return id.split('_').map(Number).map(x=>x*1000) as [number,number]; }
/** Normal-section curvature of the GRS80 ellipsoid; NHN heights remain orthometric. */
export function normalRadius(latitude: number, azimuth: number) {
  const a=6378137, f=1/298.257222101, e2=f*(2-f), q=1-e2*Math.sin(latitude*RAD)**2;
  const N=a/Math.sqrt(q), M=a*(1-e2)/q**1.5;
  return 1/(Math.cos(azimuth*RAD)**2/M+Math.sin(azimuth*RAD)**2/N);
}
export function curvatureDrop(distance: number,radius: number,k=0) { return (1-k)*distance*distance/(2*radius); }
export function apparentAngle(distance: number,height: number,observer: number,radius: number,k=0) {
  if(distance<=0 || !Number.isFinite(distance)) throw new Error('Entfernung muss positiv sein');
  if(k<0 || k>=0.9) throw new Error('k muss zwischen 0 und 0,9 liegen');
  const R=radius/(1-k), theta=distance/R;
  // cos(theta)-1 via sin(theta/2) avoids cancellation at short distances.
  const up=height-observer-2*(R+height)*Math.sin(theta/2)**2;
  const across=(R+height)*Math.sin(theta);
  return Math.atan2(up,across)/RAD;
}
/** Conservative supercover: a 250 m ray lattice with a full neighboring-tile halo.
 * Angular ray spacing is bounded to <=250 m at the far end. */
export function corridorTiles(observer: Position,start: number,end: number,distance: number): string[] {
  if(end<start || end-start>180 || distance<=0 || distance>80000) throw new Error('Ungültiger Korridor');
  const ids=new Set<string>(), count=Math.max(1,Math.ceil((end-start)*RAD*distance/250));
  for(let a=0;a<=count;a++) for(let d=0;d<=Math.ceil(distance/250);d++) {
    const [x,y]=toUTM(destination(observer,start+(end-start)*a/count,Math.min(distance,d*250)));
    for(const dx of [-1000,0,1000]) for(const dy of [-1000,0,1000]) ids.add(tileId(x+dx,y+dy));
  }
  return [...ids].sort();
}
