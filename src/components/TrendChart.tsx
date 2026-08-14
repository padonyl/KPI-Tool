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

type Point = {
  period_end: string;
  value: number;
};

export function TrendChart({ data, unit }: { data: Point[]; unit: string }) {
  return (
    <div className="viz-root">
      <style>{`
        .viz-root {
          --series-1: #2a78d6;
          --text-secondary: #52514e;
          --text-muted: #898781;
          --grid: #e1e0d9;
          --surface: #fcfcfb;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-root {
            --series-1: #3987e5;
            --text-secondary: #c3c2b7;
            --text-muted: #898781;
            --grid: #2c2c2a;
            --surface: #1a1a19;
          }
        }
        :root[data-theme="dark"] .viz-root {
          --series-1: #3987e5;
          --text-secondary: #c3c2b7;
          --text-muted: #898781;
          --grid: #2c2c2a;
          --surface: #1a1a19;
        }
      `}</style>
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
