import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard-shell";
import { formatBRL, formatInt, pct, type Campaign, type Client } from "@/lib/types";

export const Route = createFileRoute("/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios por cliente — Velocity" },
      { name: "description", content: "Gere relatórios de tráfego pago por cliente e período e exporte em PDF." },
      { property: "og:title", content: "Relatórios por cliente — Velocity" },
      { property: "og:description", content: "Relatórios de campanhas Meta Ads por período, prontos para PDF." },
    ],
  }),
  component: RelatoriosPage,
});

type Metric = { campaign_id: string | null; date: string; spend: number; clicks: number; impressions: number; conversions: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);

function RelatoriosPage() {
  const today = new Date();
  const [clientId, setClientId] = useState("");
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 29 * 864e5)));
  const [to, setTo] = useState(iso(today));

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("name")).data as Client[] ?? [],
  });
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await supabase.from("campaigns").select("*")).data as Campaign[] ?? [],
  });
  const { data: metrics = [] } = useQuery({
    queryKey: ["metrics", from, to],
    queryFn: async () =>
      ((await supabase.from("campaign_metrics").select("*").gte("date", from).lte("date", to).order("date")).data ?? []) as Metric[],
  });

  const client = clients.find((c) => c.id === clientId);
  const camps = useMemo(() => campaigns.filter((c) => c.client_id === clientId), [campaigns, clientId]);
  const ids = new Set(camps.map((c) => c.id));
  const rows = metrics.filter((m) => m.campaign_id && ids.has(m.campaign_id));
  const hasDaily = rows.length > 0;

  // Per-campaign totals: daily metrics in range when available, otherwise campaign totals.
  const perCampaign = camps.map((c) => {
    const r = rows.filter((m) => m.campaign_id === c.id);
    const t = hasDaily
      ? r.reduce((a, m) => ({ spend: a.spend + Number(m.spend), clicks: a.clicks + m.clicks, impressions: a.impressions + m.impressions, conversions: a.conversions + m.conversions }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 })
      : { spend: Number(c.spend), clicks: c.clicks, impressions: c.impressions, conversions: c.conversions };
    return { ...c, ...t };
  });
  const tot = perCampaign.reduce((a, c) => ({ spend: a.spend + c.spend, clicks: a.clicks + c.clicks, impressions: a.impressions + c.impressions, conversions: a.conversions + c.conversions }), { spend: 0, clicks: 0, impressions: 0, conversions: 0 });

  const daily = Object.values(
    rows.reduce<Record<string, { date: string; spend: number; clicks: number }>>((acc, m) => {
      const d = (acc[m.date] ??= { date: m.date.slice(5), spend: 0, clicks: 0 });
      d.spend += Number(m.spend);
      d.clicks += m.clicks;
      return acc;
    }, {}),
  );

  const input = "bg-input border border-border rounded-md px-3 py-2 text-sm text-foreground";

  return (
    <DashboardShell
      title="Relatórios"
      subtitle="Relatório de performance por cliente e período"
      actions={
        <button onClick={() => window.print()} disabled={!client} className="inline-flex items-center gap-2 bg-brand text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40">
          <FileDown className="size-4" /> Exportar PDF
        </button>
      }
    >
      <div className="flex flex-wrap gap-3 mb-8 print:hidden">
        <select className={input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Selecione um cliente</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.status !== "active" ? " (histórico)" : ""}</option>
          ))}
        </select>
        <input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {!client ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center text-muted-foreground text-sm">
          Escolha um cliente para gerar o relatório.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-border rounded-lg p-6 bg-surface">
            <div className="text-[10px] uppercase tracking-widest text-brand font-bold">Relatório de tráfego pago</div>
            <h2 className="text-2xl font-bold text-foreground mt-1">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              Período: {from.split("-").reverse().join("/")} a {to.split("-").reverse().join("/")} · {camps.length} campanha(s)
            </p>
            {!hasDaily && camps.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">Sem dados diários no período — exibindo totais acumulados das campanhas.</p>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Investimento", formatBRL(tot.spend)],
              ["Cliques", formatInt(tot.clicks)],
              ["Impressões", formatInt(tot.impressions)],
              ["Conversões", formatInt(tot.conversions)],
              ["CTR", pct(tot.clicks, tot.impressions)],
              ["CPC", formatBRL(tot.clicks ? tot.spend / tot.clicks : 0)],
              ["CPM", formatBRL(tot.impressions ? (tot.spend / tot.impressions) * 1000 : 0)],
              ["Custo/conversão", formatBRL(tot.conversions ? tot.spend / tot.conversions : 0)],
            ].map(([l, v]) => (
              <div key={l} className="border border-border rounded-lg p-4 bg-surface break-inside-avoid">
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className="text-xl font-semibold text-foreground font-mono mt-1">{v}</div>
              </div>
            ))}
          </div>

          {hasDaily && (
            <div className="grid lg:grid-cols-2 gap-4 print:grid-cols-2">
              <ChartCard title="Investimento por dia">
                <AreaChart data={daily}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Area dataKey="spend" stroke="var(--brand)" fill="var(--brand-dim)" isAnimationActive={false} />
                </AreaChart>
              </ChartCard>
              <ChartCard title="Cliques por dia">
                <BarChart data={daily}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
                  <Bar dataKey="clicks" fill="var(--brand)" isAnimationActive={false} />
                </BarChart>
              </ChartCard>
            </div>
          )}

          <div className="border border-border rounded-lg bg-surface overflow-hidden break-inside-avoid">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  {["Campanha", "Objetivo", "Plataforma", "Investimento", "Cliques", "CTR", "Conversões"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perCampaign.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Nenhuma campanha para este cliente.</td></tr>
                )}
                {perCampaign.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-foreground">{c.name}</td>
                    <td className="px-4 py-3">{c.objective ?? "—"}</td>
                    <td className="px-4 py-3">{c.platform === "both" ? "FB + IG" : c.platform === "facebook" ? "Facebook" : "Instagram"}</td>
                    <td className="px-4 py-3 font-mono">{formatBRL(c.spend)}</td>
                    <td className="px-4 py-3 font-mono">{formatInt(c.clicks)}</td>
                    <td className="px-4 py-3 font-mono">{pct(c.clicks, c.impressions)}</td>
                    <td className="px-4 py-3 font-mono">{formatInt(c.conversions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-surface break-inside-avoid">
      <div className="text-sm font-medium text-foreground mb-3">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}
