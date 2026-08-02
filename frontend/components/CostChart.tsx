// components/CostChart.tsx
"use client";

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface CostChartProps {
  data: Record<string, unknown>[];
}

// Grafik türünü veriye bakarak otomatik seçiyoruz:
// - Kolon adlarında "Ay"/"Tarih"/"Date" geçiyorsa -> çizgi grafik (trend)
// - Aksi halde -> çubuk grafik (kategori karşılaştırması, ör. top-5 servis)
function detectChartType(data: Record<string, unknown>[]): "line" | "bar" {
  if (data.length === 0) return "bar";
  const keys = Object.keys(data[0]).map((k) => k.toLowerCase());
  const hasTimeKey = keys.some((k) => k.includes("ay") || k.includes("tarih") || k.includes("date"));
  return hasTimeKey ? "line" : "bar";
}

// İlk kolonu eksen (kategori/tarih), ilk sayısal kolonu değer olarak kullan.
function detectAxisKeys(data: Record<string, unknown>[]): { xKey: string; yKey: string } | null {
  if (data.length === 0) return null;
  const keys = Object.keys(data[0]);
  const xKey = keys[0];
  const yKey = keys.find((k) => typeof data[0][k] === "number") || keys[1] || keys[0];
  return { xKey, yKey };
}

export default function CostChart({ data }: CostChartProps) {
  if (!data || data.length === 0) return null;

  const axisKeys = detectAxisKeys(data);
  if (!axisKeys) return null;
  const { xKey, yKey } = axisKeys;
  const chartType = detectChartType(data);

  return (
    <div className="w-full h-72 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 my-2">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} interval={0} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey={yKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}