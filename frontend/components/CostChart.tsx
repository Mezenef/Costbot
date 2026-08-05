// components/CostChart.tsx
"use client";

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface CostChartProps {
  data: Record<string, unknown>[];
}

function detectChartType(data: Record<string, unknown>[]): "line" | "bar" {
  if (data.length === 0) return "bar";
  const keys = Object.keys(data[0]).map((k) => k.toLowerCase());
  const hasTimeKey = keys.some((k) => k.includes("ay") || k.includes("tarih") || k.includes("date"));
  return hasTimeKey ? "line" : "bar";
}

function detectAxisKeys(data: Record<string, unknown>[]): { xKey: string; yKey: string } | null {
  if (data.length === 0) return null;
  const keys = Object.keys(data[0]);
  const xKey = keys[0];
  const yKey = keys.find((k) => typeof data[0][k] === "number") || keys[1] || keys[0];
  return { xKey, yKey };
}

// Çok sayıda kategori (ör. 29 servis) varsa, dikey etiketler yerine
// yatay çubuklu bir düzene geçiyoruz -- bu sayıda kategori, X eksenine
// hiçbir açıyla okunaklı sığmıyor.
const MANY_CATEGORIES_THRESHOLD = 10;

export default function CostChart({ data }: CostChartProps) {
  if (!data || data.length === 0) return null;

  const axisKeys = detectAxisKeys(data);
  if (!axisKeys) return null;
  const { xKey, yKey } = axisKeys;
  const chartType = detectChartType(data);
  const isManyCategories = chartType === "bar" && data.length > MANY_CATEGORIES_THRESHOLD;

  const containerHeight = isManyCategories
    ? Math.max(288, data.length * 26)
    : 288;

  return (
    <div
      className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 my-2"
      style={{ height: containerHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} interval={0} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey={yKey} stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        ) : isManyCategories ? (
          <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey={xKey} tick={{ fontSize: 10 }} width={140} interval={0} />
            <Tooltip />
            <Bar dataKey={yKey} fill="#2563eb" radius={[0, 4, 4, 0]} />
          </BarChart>
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