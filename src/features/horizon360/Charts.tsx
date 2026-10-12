import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { HorizonResult } from "./types";
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
]);
export function HorizonChart({
  result,
  selected,
  onSelect,
}: {
  result: HorizonResult;
  selected: number;
  onSelect: (az: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null),
    chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = echarts.init(ref.current, undefined, { renderer: "svg" });
    chart.current = c;
    const ds = [...result.directions];
    if (ds[0]?.azimuth === 0) ds.push({ ...ds[0], azimuth: 360 });
    const line = (name: string, color: string, values: (number | null)[]) => ({
      name,
      type: "line" as const,
      showSymbol: false,
      smooth: false,
      connectNulls: false,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      data: ds.map((d, n) => [d.azimuth, values[n]]),
    });
    c.setOption({
      legend: { top: 0 },
      tooltip: { trigger: "axis" },
      grid: { left: 60, right: 20, top: 50, bottom: 75 },
      xAxis: {
        type: "value",
        min: 0,
        max: 360,
        name: "Azimut ° · N=0 / O=90 / S=180 / W=270",
        nameLocation: "middle",
        nameGap: 30,
      },
      yAxis: { type: "value", name: "Höhe °" },
      dataZoom: [
        { type: "inside", filterMode: "none" },
        { type: "slider", bottom: 5 },
      ],
      series: [
        {
          ...line(
            "DGM1",
            "#087f8c",
            ds.map((d) => d.terrain.blocker?.angle ?? null),
          ),
          markArea: {
            silent: true,
            itemStyle: {
              color: "rgba(120,120,120,0.06)",
              decal: {
                symbol: "rect",
                dashArrayX: [1, 0],
                dashArrayY: [2, 7],
                rotation: Math.PI / 4,
              },
            },
            data: [[{ xAxis: 0 }, { xAxis: 360 }]],
          },
        },
        line(
          "DOM20",
          "#7c3aed",
          ds.map((d) => d.surface.blocker?.angle ?? null),
        ),
        line(
          "Abgetastetes Maximum",
          "#b45b00",
          ds.map((d) => d.actual),
        ),
        line(
          "Planung VORLÄUFIG",
          "#c22c54",
          ds.map((d) => d.planning),
        ),
        line(
          "Mindesthöhe",
          "#64748b",
          ds.map(() => result.inputs.minAltitude),
        ),
      ],
    });
    c.getZr().on("click", (event) => {
      const p = c.convertFromPixel({ gridIndex: 0 }, [
        event.offsetX,
        event.offsetY,
      ]);
      if (Array.isArray(p) && Number.isFinite(p[0]))
        onSelect(Math.max(0, Math.min(359.999, p[0])));
    });
    const resize = new ResizeObserver(() => c.resize());
    resize.observe(ref.current);
    return () => {
      resize.disconnect();
      c.dispose();
      chart.current = null;
    };
  }, [result, onSelect]);
  useEffect(() => {
    chart.current?.setOption({
      series: [
        {
          markLine: {
            symbol: "none",
            data: [{ xAxis: selected, label: { formatter: "Auswahl" } }],
          },
        },
      ],
    });
  }, [selected]);
  return (
    <>
      <div
        ref={ref}
        className="h360-chart"
        role="img"
        aria-label="360°-Höhenkurve. Alle Sektoren unvollständig; exakte Werte in der Tabelle."
      />
      <button
        onClick={() => {
          const svg = ref.current?.querySelector("svg");
          if (!svg) return;
          const url = URL.createObjectURL(
            new Blob([new XMLSerializer().serializeToString(svg)], {
              type: "image/svg+xml",
            }),
          );
          const a = document.createElement("a");
          a.href = url;
          a.download = "astro360-provisional.svg";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        SVG herunterladen
      </button>
    </>
  );
}
export function PolarDome({
  result,
  selected,
  onSelect,
}: {
  result: HorizonResult;
  selected: number;
  onSelect: (az: number) => void;
}) {
  const xy = (a: number, h: number) => {
    const radius = (140 * (90 - Math.max(0, Math.min(90, h)))) / 90;
    return [
      170 + radius * Math.sin((a * Math.PI) / 180),
      170 - radius * Math.cos((a * Math.PI) / 180),
    ];
  };
  const [sx, sy] = xy(selected, 0);
  return (
    <svg
      viewBox="0 0 340 340"
      className="h360-polar"
      role="img"
      aria-label="Himmelskuppel: Norden oben, Osten rechts; alle Sektoren unvollständig"
      onClick={(e) => {
        const box = e.currentTarget.getBoundingClientRect();
        onSelect(
          ((Math.atan2(
            e.clientX - (box.left + box.width / 2),
            box.top + box.height / 2 - e.clientY,
          ) *
            180) /
            Math.PI +
            360) %
            360,
        );
      }}
    >
      <defs>
        <pattern
          id="h360-hatch"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M 0 0 L 0 8" stroke="#888" strokeWidth="1" />
        </pattern>
      </defs>
      <circle cx="170" cy="170" r="140" fill="url(#h360-hatch)" />
      {[0, 30, 60].map((h) => (
        <g key={h}>
          <circle
            cx="170"
            cy="170"
            r={(140 * (90 - h)) / 90}
            fill="none"
            stroke="#aab7c2"
          />
          <text x="173" y={170 - (140 * (90 - h)) / 90 + 14}>
            {h}°
          </text>
        </g>
      ))}
      <circle
        cx="170"
        cy="170"
        r={(140 * (90 - Math.max(0, result.inputs.minAltitude))) / 90}
        fill="none"
        stroke="#c22c54"
        strokeDasharray="4 4"
      />
      {result.directions.map((d, n) => {
        if (d.actual === null) return null;
        const next = result.directions[(n + 1) % result.directions.length];
        if (next.actual === null) return null;
        const [x, y] = xy(d.azimuth, d.actual),
          [x2, y2] = xy(next.azimuth, next.actual);
        return (
          <line
            key={d.azimuth}
            x1={x}
            y1={y}
            x2={x2}
            y2={y2}
            stroke="#087f8c"
            strokeWidth="2"
          />
        );
      })}
      <line
        x1="170"
        y1="170"
        x2={sx}
        y2={sy}
        stroke="#b45b00"
        strokeWidth="2"
      />
      <text x="165" y="20">
        N
      </text>
      <text x="320" y="175">
        O
      </text>
      <text x="165" y="334">
        S
      </text>
      <text x="7" y="175">
        W
      </text>
      <text x="175" y="180">
        90°
      </text>
    </svg>
  );
}
