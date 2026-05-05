"use client";

import dynamic from "next/dynamic";
import { ApexOptions, ApexAxisChartSeries, ApexNonAxisChartSeries } from "apexcharts";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <div className="animate-pulse bg-muted rounded h-full w-full" />
    </div>
  ),
});

interface ChartProps {
  options: ApexOptions;
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  type:
    | "line"
    | "area"
    | "bar"
    | "pie"
    | "donut"
    | "radialBar"
    | "scatter"
    | "bubble"
    | "heatmap"
    | "candlestick"
    | "boxPlot"
    | "radar"
    | "polarArea"
    | "rangeBar"
    | "rangeArea"
    | "treemap";
  height?: string | number;
  width?: string | number;
}

export function Chart({
  options,
  series,
  type,
  height = "100%",
  width = "100%",
}: ChartProps) {
  return (
    <ReactApexChart
      options={options}
      series={series}
      type={type}
      height={height}
      width={width}
    />
  );
}
