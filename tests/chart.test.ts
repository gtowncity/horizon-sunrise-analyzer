import { describe, expect, it } from "vitest";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { GridComponent, DataZoomComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { profileLine } from "../src/components/profile-series";

echarts.use([LineChart, GridComponent, DataZoomComponent, SVGRenderer]);

describe("profile rendering across data gaps", () => {
  it("preserves point order, gaps and peaks after repeated zoom/pan/resize", () => {
    // Synthetic only: many null runs trigger the LTTB + dataZoom index bug.
    const values = Array.from({ length: 10001 }, (_, j) => [
      j / 1000,
      j % 701 < 160 ? null : 300 + Math.sin(j / 23) + (j % 137 === 0 ? 30 : 0),
    ]);
    const chart = echarts.init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 980,
      height: 340,
    });
    try {
      chart.setOption({
        animation: false,
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        dataZoom: [{ type: "inside" }, { type: "slider" }],
        series: [profileLine("DOM20", "#7c3aed", values)],
      });
      for (const width of [980, 390]) {
        chart.resize({ width });
        for (const [start, end] of [
          [7, 33.66],
          [15.17, 50],
          [20, 55],
          [0, 100],
        ]) {
          chart.dispatchAction({ type: "dataZoom", start, end });
          // Inspect the processed ECharts data, not merely our option object.
          // @ts-expect-error Test-only inspection of ECharts' private processed model.
          const data = chart.getModel().getSeriesByIndex(0).getData();
          const indices = Array.from({ length: data.count() }, (_, j) =>
            data.getRawIndex(j),
          );
          expect(indices.every((v, j) => !j || v > indices[j - 1])).toBe(true);
          // The slider rounds its range to display precision. Within the
          // resulting window every original point (including nulls) remains.
          expect(indices.length).toBeGreaterThan(100);
          expect(indices).toEqual(
            Array.from(
              { length: indices.at(-1)! - indices[0] + 1 },
              (_, j) => indices[0] + j,
            ),
          );
          expect(indices.some((j) => values[j][1] === null)).toBe(true);
          for (let j = 0; j < data.count(); j++) {
            const original = values[indices[j]][1];
            const rendered = data.get("y", j);
            if (original === null) expect(Number.isNaN(rendered)).toBe(true);
            else expect(rendered).toBe(original);
          }
        }
      }
    } finally {
      chart.dispose();
    }
  });
});
