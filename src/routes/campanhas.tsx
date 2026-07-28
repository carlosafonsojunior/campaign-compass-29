import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, pct, CAMPAIGN_OBJECTIVES, type Campaign, type Client } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/campanhas")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha excluída");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = campaigns.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <DashboardShell
      title="Campanhas"
      subtitle={`${campaigns.length} no total`}
      actions={
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-xs font-semibold bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors uppercase tracking-wider"
        >
          + Nova Campanha
        </button>
      }
    >
      <div className="space-y-4">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar campanhas..."
          className="w-80 bg-surface border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-brand/50"
        />

        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-muted-foreground font-bold border-b border-border">
              <tr>
                <th className="px-6 py-4">Nome da Campanha</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Plataforma</th>
                <th className="px-6 py-4 text-right">Gasto</th>
                <th className="px-6 py-4 text-right">Cliques</th>
                <th className="px-6 py-4 text-right">CTR</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground text-xs uppercase tracking-widest">
                    Nenhuma campanha
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-foreground/2 group">
                  <td className="px-6 py-4 font-medium text-foreground">
                    {c.name}
                    {c.meta_campaign_id && (
                      <span className="ml-2 text-[10px] text-brand/70 font-mono">META</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          "size-1.5 rounded-full " +
                          (c.status === "active" ? "bg-brand" : c.status === "paused" ? "bg-yellow-500" : "bg-muted-foreground")
                        }
                      />
                      <span className="capitalize text-xs">{c.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {c.platform === "both" ? "FB + IG" : c.platform === "facebook" ? "Facebook" : "Instagram"}
                  </td>
                  <td className="px-6 py-4 font-mono text-right">{formatBRL(Number(c.spend))}</td>
                  <td className="px-6 py-4 font-mono text-right">{formatInt(c.clicks)}</td>
                  <td className="px-6 py-4 font-mono text-right text-brand">{pct(c.clicks, c.impressions)}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Excluir campanha "${c.name}"?`)) del.mutate(c.id);
                      }}
                      className="text-xs font-bold text-destructive hover:underline uppercase"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <NewCampaignDialog onClose={() => setOpen(false)} />}
    </DashboardShell>
  );
}

function NewCampaignDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    platform: "both" as "facebook" | "instagram" | "both",
    objective: CAMPAIGN_OBJECTIVES[0] as string,
    daily_budget: "50",
    status: "active" as "active" | "paused",
    client_id: "",
    notes: "",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
      return (data ?? []) as Client[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campaigns").insert({
        name: form.name,
        platform: form.platform,
        objective: form.objective || null,
        daily_budget: Number(form.daily_budget) || 0,
        status: form.status,
        client_id: form.client_id || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha criada");
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 grid place-items-center p-6" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Nova Campanha</h2>
          <p className="text-xs text-muted-foreground">Cadastre manualmente ou sincronize da Meta em Integrações.</p>
        </div>

        <Field label="Nome">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-brand/50"
            placeholder="Ex: BFCM_Prospecting_V1"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Plataforma">
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value as typeof form.platform })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="both">Facebook + Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="active">Ativa</option>
              <option value="paused">Pausada</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo">
            <select
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              {CAMPAIGN_OBJECTIVES.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Orçamento diário (R$)">
            <input
              type="number"
              value={form.daily_budget}
              onChange={(e) => setForm({ ...form, daily_budget: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </Field>
        </div>

        <Field label="Cliente">
          <select
            value={form.client_id}
            onChange={(e) => setForm({ ...form, client_id: e.target.value })}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
          >
            <option value="">Sem cliente vinculado</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>


        <Field label="Notas">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none"
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-xs uppercase text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
          <button
            onClick={() => form.name && create.mutate()}
            disabled={!form.name || create.isPending}
            className="px-4 py-2 text-xs font-bold bg-brand text-primary-foreground rounded-sm hover:bg-brand/90 disabled:opacity-50 uppercase tracking-wider"
          >
            {create.isPending ? "Salvando..." : "Criar campanha"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</span>
      {children}
    </label>
  );
}
