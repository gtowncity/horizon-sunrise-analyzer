import type { HorizonDirection, HorizonResult } from "./types";
export type PlotPoint = { azimuth: number; direction: HorizonDirection | null };
/** Unknown intervals are explicit breaks, including the north-closing interval. */
export function horizonPlotPoints(r: HorizonResult): PlotPoint[] {
  const out: PlotPoint[] = [];
  r.directions.forEach((d) => {
    out.push({ azimuth: d.azimuth, direction: d });
    if (d.nextAngularGap > r.inputs.initialAzimuthStep + 1e-9)
      out.push({ azimuth: d.azimuth + d.nextAngularGap / 2, direction: null });
  });
  if (r.directions[0]?.azimuth === 0)
    out.push({ azimuth: 360, direction: r.directions[0] });
  return out;
}
