"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string; // "2025-07"
  count: number;
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  const date = new Date(parseInt(y), parseInt(m) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export default function WatchGraph({ data }: { data: MonthlyData[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatMonth(d.month),
  }));

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-5">
      <h2 className="text-white text-base font-bold mb-1">
        📊 Monthly Watch Activity
      </h2>
      <p className="text-text-secondary text-xs mb-4">Episodes watched per month</p>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted} margin={{ top: 4, right: 0, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={{ stroke: "#2d2d4a" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a2e",
                border: "1px solid #2d2d4a",
                borderRadius: "12px",
                color: "#fff",
                fontSize: "12px",
              }}
              cursor={{ fill: "#2d2d4a", opacity: 0.3 }}
              formatter={(value: any) => [`${value} episodes`, ""]}
              labelFormatter={(label: any) => label}
            />
            <Bar
              dataKey="count"
              fill="url(#barGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
