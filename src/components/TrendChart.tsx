"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatNumber } from "@/lib/format-number";
import { VizTheme } from "./viz/VizTheme";

type Point = {
  period_end: string;
  value: number;
};

export function TrendChart({ data, unit }: { data: Point[]; unit: string }) {
  return (
    <div className="viz-root">
      <VizTheme />
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--grid)"
            strokeDasharray="0"
          />
          <XAxis
            dataKey="period_end"
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={{ stroke: "var(--grid)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-muted)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--grid)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-secondary)",
            }}
            formatter={(value) => [`${formatNumber(Number(value))} ${unit}`, ""]}
            labelFormatter={(label) => label}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--series-1)", stroke: "var(--surface)", strokeWidth: 2 }}
            activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
