"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

/** Série única: colaboradores ativos por dia. */
export function ActivityChart({ data }: { data: { date: string; activeUsers: number; minutes: number }[] }) {
  const config = {
    activeUsers: { label: "Colaboradores ativos", color: "var(--chart-1)" },
  } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-activeUsers)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-activeUsers)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={shortDate} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload as { date: string; minutes: number } | undefined;
                return p ? `${shortDate(p.date)} · ${p.minutes} min estudados` : "";
              }}
            />
          }
        />
        <Area
          dataKey="activeUsers"
          type="monotone"
          stroke="var(--color-activeUsers)"
          strokeWidth={2}
          fill="url(#fillActive)"
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Barras horizontais de série única (ex.: % de conclusão por módulo). */
export function HorizontalPercentBars({
  data,
  label,
}: {
  data: { name: string; value: number; detail?: string }[];
  label: string;
}) {
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: Math.max(120, data.length * 44 + 16) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 44, top: 4, bottom: 4 }} barCategoryGap={10}>
        <CartesianGrid horizontal={false} strokeOpacity={0.5} />
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={150} tick={{ fontSize: 12 }} />
        <ChartTooltip
          cursor={{ fillOpacity: 0.06 }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <div className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">{(item.payload as { detail?: string }).detail ?? label}</span>
                  <span className="font-mono font-medium tabular-nums">{Math.round(Number(value))}%</span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} maxBarSize={22}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            fontSize={12}
            formatter={(v: unknown) => `${Math.round(Number(v))}%`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Distribuição de notas/valores em colunas de série única. */
export function ColumnChart({
  data,
  label,
  suffix = "",
}: {
  data: { name: string; value: number }[];
  label: string;
  suffix?: string;
}) {
  const config = { value: { label, color: "var(--chart-1)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 16 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.5} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip cursor={{ fillOpacity: 0.06 }} content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={36}>
          <LabelList dataKey="value" position="top" className="fill-muted-foreground" fontSize={11} formatter={(v: unknown) => (Number(v) ? `${v}${suffix}` : "")} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
