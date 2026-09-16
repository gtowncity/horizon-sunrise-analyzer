export function bilinear(values: readonly number[], fx: number,fy: number,nodata: number | null=-9999) {
  if(values.length!==4 || fx<0 || fx>1 || fy<0 || fy>1) throw new Error('Ungültige Interpolationsparameter');
  const weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
  let sum=0;
  for(let i=0;i<4;i++) {
    if(weights[i]<1e-14) continue;
    if(!Number.isFinite(values[i]) || values[i]===nodata) throw new Error('NoData: Höhenwert fehlt');
    sum+=values[i]*weights[i];
  }
  return sum;
}
export function gridCoordinates(x: number,y: number,originX: number,originY: number,resolution: number,pixelIsArea=true) {
  const offset=pixelIsArea?0.5:0;
  const col=(x-originX)/resolution-offset, row=(originY-y)/resolution-offset;
  return {col:Math.floor(col),row:Math.floor(row),fx:col-Math.floor(col),fy:row-Math.floor(row)};
}
