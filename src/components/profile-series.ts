import type { LineSeriesOption } from "echarts/charts";

export function profileLine(
  name: string,
  color: string,
  data: (number | null)[][],
): LineSeriesOption {
  return {
    name,
    type: "line",
    showSymbol: false,
    lineStyle: { width: 2, color },
    itemStyle: { color },
    // ECharts LTTB can emit out-of-order raw indices after dataZoom filtering
    // when a bucket contains missing values. Render gapped series unchanged:
    // preserve every observed peak and every missing-data boundary.
    sampling: data.every(([, y]) => y !== null && Number.isFinite(y))
      ? "lttb"
      : "none",
    data,
    connectNulls: false,
  };
}
