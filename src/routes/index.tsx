import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, pct, type Campaign } from "@/lib/types";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const [metric, setMetric] = useState<"spend" | "clicks" | "conversions">("spend");

  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, c) => ({
        spend: acc.spend + Number(c.spend || 0),
        clicks: acc.clicks + (c.clicks || 0),
        impressions: acc.impressions + (c.impressions || 0),
        conversions: acc.conversions + (c.conversions || 0),
      }),
      { spend: 0, clicks: 0, impressions: 0, conversions: 0 },
    );
  }, [campaigns]);

  const ctr = pct(totals.clicks, totals.impressions);
  const cpc = totals.clicks ? formatBRL(totals.spend / totals.clicks) : formatBRL(0);

  // Chart: aggregate per campaign
  const chartData = campaigns.slice(0, 12).map((c) => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
    spend: Number(c.spend || 0),
    clicks: c.clicks || 0,
    conversions: c.conversions || 0,
  }));

  const platformData = useMemo(() => {
    const groups: Record<string, { name: string; spend: number; clicks: number }> = {};
    for (const c of campaigns) {
      const k = c.platform;
      groups[k] ??= { name: k === "both" ? "Facebook + Instagram" : k === "facebook" ? "Facebook" : "Instagram", spend: 0, clicks: 0 };
      groups[k].spend += Number(c.spend || 0);
      groups[k].clicks += c.clicks || 0;
    }
    return Object.values(groups);
  }, [campaigns]);

  return (
    <DashboardShell
      title="Campaign Overview"
      subtitle={`${campaigns.length} campanha${campaigns.length === 1 ? "" : "s"} • Últimos 30 dias`}
      actions={
        <Link
          to="/campanhas"
          className="px-4 py-2 text-xs font-semibold bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors uppercase tracking-wider"
        >
          + Nova Campanha
        </Link>
      }
    >
      <div className="space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-6">
          <Kpi label="Gasto Total" value={formatBRL(totals.spend)} hint="soma de todas as campanhas" />
          <Kpi label="Cliques" value={formatInt(totals.clicks)} hint="total no período" />
          <Kpi label="CTR Médio" value={ctr} hint="clicks / impressões" accent />
          <Kpi label="CPC Médio" value={cpc} hint="custo por clique" />
        </div>

        {/* Main chart */}
        <div className="bg-surface border border-border rounded-lg p-6">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-sm font-semibold text-foreground">Performance por Campanha</h3>
            <div className="flex gap-4 text-[10px] uppercase font-bold">
              {(["spend", "clicks", "conversions"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={
                    metric === m
                      ? "text-brand border-b border-brand pb-1"
                      : "text-muted-foreground hover:text-foreground"
                  }
                >
                  {m === "spend" ? "Gasto" : m === "clicks" ? "Cliques" : "Conversões"}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="brandFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.87 0.28 145)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.87 0.28 145)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(0.24 0 0)" vertical={false} />
                  <XAxis dataKey="name" stroke="oklch(0.55 0.005 240)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="oklch(0.55 0.005 240)" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.18 0 0)", border: "1px solid oklch(0.24 0 0)", fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey={metric}
                    stroke="oklch(0.87 0.28 145)"
                    strokeWidth={2}
                    fill="url(#brandFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-surface border border-border rounded-lg p-6">
            <h3 className="text-sm font-semibold text-foreground mb-6">Gasto por Plataforma</h3>
            <div className="h-56">
              {platformData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData}>
                    <CartesianGrid stroke="oklch(0.24 0 0)" vertical={false} />
                    <XAxis dataKey="name" stroke="oklch(0.55 0.005 240)" tick={{ fontSize: 10 }} />
                    <YAxis stroke="oklch(0.55 0.005 240)" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "oklch(0.18 0 0)", border: "1px solid oklch(0.24 0 0)", fontSize: 12 }} />
                    <Bar dataKey="spend" fill="oklch(0.87 0.28 145)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Resumo</h3>
              <p className="text-xs text-muted-foreground">Métricas agregadas do período.</p>
            </div>
            <dl className="space-y-3 mt-6 text-sm font-mono">
              <Row label="Impressões" value={formatInt(totals.impressions)} />
              <Row label="Conversões" value={formatInt(totals.conversions)} />
              <Row label="Custo/Conversão" value={totals.conversions ? formatBRL(totals.spend / totals.conversions) : "—"} />
              <Row label="Campanhas ativas" value={String(campaigns.filter((c) => c.status === "active").length)} />
            </dl>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: boolean }) {
  return (
    <div className="p-6 bg-surface border border-border rounded-lg hover:border-brand/40 transition-all">
      <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-widest">{label}</div>
      <div className="text-2xl font-mono text-foreground">{value}</div>
      <div className={"mt-2 text-xs font-medium " + (accent ? "text-brand" : "text-muted-foreground")}>{hint}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full grid place-items-center text-xs text-muted-foreground uppercase tracking-widest">
      Nenhuma campanha ainda — crie ou sincronize com Meta Ads
    </div>
  );
}
