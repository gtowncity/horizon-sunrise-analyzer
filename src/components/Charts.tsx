import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart, ScatterChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { Analysis } from "../core/types";
echarts.use([
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkPointComponent,
  MarkLineComponent,
  CanvasRenderer,
]);
export function ProfileChart({
  result,
  kind,
}: {
  result: Analysis;
  kind: "height" | "angle" | "horizon" | "excess";
}) {
  const ref = useRef<HTMLDivElement>(null),
    instance = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current);
    instance.current = c;
    const samples = result.profile.samples.filter((s) => s.distance > 0),
      isHeight = kind === "height",
      isHorizon = kind === "horizon",
      isExcess = kind === "excess";
    const b = result.profile.blocker,
      eye =
        result.profile.ground +
        result.inputs.observerHeight +
        result.inputs.groundOffset;
    const line = (name: string, color: string, data: (number | null)[][]) => ({
      name,
      type: "line" as const,
      showSymbol: false,
      lineStyle: { width: 2, color },
      itemStyle: { color },
      sampling: "lttb" as const,
      data,
      connectNulls: false,
    });
    const series = isHorizon
      ? [
          line(
            "H(A)",
            "#d97706",
            result.horizon.map((h) => [h.azimuth, h.angle]),
          ),
        ]
      : isExcess
        ? [
            line(
              "Surface minus Terrain",
              "#7c3aed",
              samples.map((s) => [s.distance / 1000, s.excess ?? null]),
            ),
          ]
        : [
            line(
              "DGM1",
              "#087f8c",
              samples.map((s) => [
                s.distance / 1000,
                isHeight ? s.terrain : s.angle,
              ]),
            ),
            line(
              "DOM20",
              "#7c3aed",
              samples.map((s) => [
                s.distance / 1000,
                isHeight ? (s.surface ?? null) : (s.surfaceAngle ?? null),
              ]),
            ),
            ...(isHeight
              ? [
                  line(
                    "Horizontalstrahl inkl. Krümmung",
                    "#9aa8b7",
                    samples.map((s) => [s.distance / 1000, eye + s.drop]),
                  ),
                  line(
                    "Tangente zum Horizont",
                    "#d97706",
                    samples.map((s) => [
                      s.distance / 1000,
                      eye +
                        Math.tan(
                          ((result.contact?.limbAltitude ?? b.angle) *
                            Math.PI) /
                            180,
                        ) *
                          s.distance +
                        s.drop,
                    ]),
                  ),
                ]
              : []),
            {
              name: "Horizontpunkt",
              type: "scatter" as const,
              itemStyle: { color: "#d97706" },
              symbolSize: 11,
              data: [[b.distance / 1000, isHeight ? b.terrain : b.angle]],
            },
          ];
    c.setOption({
      animation: false,
      color: ["#087f8c", "#7c3aed", "#d97706"],
      grid: { left: 65, right: 25, top: 45, bottom: 65 },
      legend: { top: 0, textStyle: { fontSize: 12 } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v: unknown) =>
          typeof v === "number" ? v.toFixed(3) : String(v),
        formatter: (raw: unknown) => {
          const item = (Array.isArray(raw) ? raw[0] : raw) as {
            value?: number[];
          };
          const x = item?.value?.[0];
          if (x === undefined) return "";
          if (isHorizon)
            return `Azimut ${x.toFixed(3)}°<br>Horizont ${item.value![1].toFixed(4)}°`;
          let lo = 0,
            hi = samples.length - 1;
          while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (samples[mid].distance / 1000 < x) lo = mid;
            else hi = mid;
          }
          const s =
            Math.abs(samples[lo].distance / 1000 - x) <
            Math.abs(samples[hi].distance / 1000 - x)
              ? samples[lo]
              : samples[hi];
          return `${s.distance.toFixed(2)} m · Azimut ${result.profile.azimuth.toFixed(3)}°<br>${s.lat.toFixed(6)}° N, ${s.lon.toFixed(6)}° E<br>DGM1 ${s.terrain.toFixed(3)} m NHN<br>DOM20 ${s.surface?.toFixed(3) ?? "nicht verfügbar"}<br>DOM−DGM ${s.excess?.toFixed(3) ?? "—"} m<br>Terrainwinkel ${s.angle.toFixed(4)}°`;
        },
      },
      xAxis: {
        type: "value",
        scale: isHorizon,
        name: isHorizon ? "Azimut °" : "km",
        nameLocation: "end",
        axisLabel: { color: "#536278" },
      },
      yAxis: {
        type: "value",
        name: isHeight ? "m NHN" : isExcess ? "m über DGM1" : "Höhenwinkel °",
        scale: true,
        splitLine: { lineStyle: { color: "#e6ebf0" } },
      },
      dataZoom: [
        { type: "inside" },
        { type: "slider", height: 18, bottom: 12 },
      ],
      series,
    });
    const resize = new ResizeObserver(() => c.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      c.dispose();
    };
  }, [result, kind]);
  return (
    <div className="chart-wrap">
      <div
        ref={ref}
        className="chart"
        role="img"
        aria-label={`${kind}: interaktives Profil. Werte stehen auch in der Profiltabelle.`}
      />
      <button
        className="text-button"
        onClick={() => {
          const a = document.createElement("a");
          a.href = instance.current!.getDataURL({
            type: "png",
            pixelRatio: 2,
            backgroundColor: "#fff",
          });
          a.download = `horizon-${kind}.png`;
          a.click();
        }}
      >
        Diagramm als PNG
      </button>
    </div>
  );
}
