import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatInt, type Campaign, type Client } from "@/lib/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Velocity Ads" },
      { name: "description", content: "Cadastro de clientes e histórico de campanhas por pessoa ou empresa." },
      { property: "og:title", content: "Clientes — Velocity Ads" },
      { property: "og:description", content: "Cadastro de clientes e histórico de campanhas por pessoa ou empresa." },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Client[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const toggle = useMutation({
    mutationFn: async (c: Client) => {
      const { error } = await supabase
        .from("clients")
        .update({ status: c.status === "active" ? "inactive" : "active" })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Situação do cliente atualizada");
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byClient = useMemo(() => {
    const map: Record<string, Campaign[]> = {};
    for (const c of campaigns) {
      if (!c.client_id) continue;
      (map[c.client_id] ??= []).push(c);
    }
    return map;
  }, [campaigns]);

  const visible = clients.filter((c) => showInactive || c.status === "active");
  const current = selected ? clients.find((c) => c.id === selected) ?? null : null;
  const currentCampaigns = selected ? byClient[selected] ?? [] : [];

  return (
    <DashboardShell
      title="Clientes"
      subtitle={`${clients.length} cadastrado${clients.length === 1 ? "" : "s"} • histórico preservado`}
      actions={
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-xs font-semibold bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors uppercase tracking-wider"
        >
          + Novo Cliente
        </button>
      }
    >
      <div className="grid grid-cols-[1.1fr_1fr] gap-6 items-start">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar clientes inativos (histórico)
          </label>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase text-muted-foreground font-bold border-b border-border">
                <tr>
                  <th className="px-5 py-4">Cliente</th>
                  <th className="px-5 py-4">Tipo</th>
                  <th className="px-5 py-4 text-right">Ativas</th>
                  <th className="px-5 py-4 text-right">Gasto</th>
                  <th className="px-5 py-4 text-right">Situação</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-border">
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-muted-foreground text-xs uppercase tracking-widest">
                      Nenhum cliente cadastrado
                    </td>
                  </tr>
                )}
                {visible.map((c) => {
                  const list = byClient[c.id] ?? [];
                  const active = list.filter((x) => x.status === "active").length;
                  const spend = list.reduce((a, x) => a + Number(x.spend || 0), 0);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      className={
                        "cursor-pointer hover:bg-foreground/5 " + (selected === c.id ? "bg-foreground/5" : "")
                      }
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-foreground">{c.name}</div>
                        {c.email && <div className="text-[11px] text-muted-foreground">{c.email}</div>}
                      </td>
                      <td className="px-5 py-4 text-xs capitalize">{c.kind}</td>
                      <td className="px-5 py-4 font-mono text-right text-brand">{active}</td>
                      <td className="px-5 py-4 font-mono text-right">{formatBRL(spend)}</td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle.mutate(c);
                          }}
                          className={
                            "text-[10px] uppercase font-bold px-2 py-1 rounded-sm border " +
                            (c.status === "active"
                              ? "text-brand border-brand/30 bg-brand/5"
                              : "text-muted-foreground border-border")
                          }
                        >
                          {c.status === "active" ? "Ativo" : "Histórico"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 min-h-[300px]">
          {!current ? (
            <div className="h-full grid place-items-center text-xs text-muted-foreground uppercase tracking-widest py-16">
              Selecione um cliente para ver as campanhas
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground">{current.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {[current.company, current.document, current.phone].filter(Boolean).join(" • ") || "Sem dados adicionais"}
                </p>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
                  Campanhas ativas
                </div>
                <div className="space-y-2">
                  {currentCampaigns.filter((c) => c.status === "active").length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma campanha ativa no momento.</p>
                  )}
                  {currentCampaigns
                    .filter((c) => c.status === "active")
                    .map((c) => (
                      <CampaignRow key={c.id} c={c} />
                    ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">
                  Histórico
                </div>
                <div className="space-y-2">
                  {currentCampaigns.filter((c) => c.status !== "active").length === 0 && (
                    <p className="text-xs text-muted-foreground">Sem campanhas encerradas.</p>
                  )}
                  {currentCampaigns
                    .filter((c) => c.status !== "active")
                    .map((c) => (
                      <CampaignRow key={c.id} c={c} muted />
                    ))}
                </div>
              </div>

              {current.notes && (
                <p className="text-xs text-muted-foreground border-t border-border pt-4">{current.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {open && <NewClientDialog onClose={() => setOpen(false)} />}
    </DashboardShell>
  );
}

function CampaignRow({ c, muted }: { c: Campaign; muted?: boolean }) {
  return (
    <div
      className={
        "flex items-center justify-between border border-border rounded-md px-3 py-2 " +
        (muted ? "opacity-60" : "")
      }
    >
      <div>
        <div className="text-sm text-foreground">{c.name}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {c.objective || "sem objetivo"} • {c.platform === "both" ? "FB + IG" : c.platform}
        </div>
      </div>
      <div className="text-right font-mono text-xs">
        <div className="text-foreground">{formatBRL(Number(c.spend))}</div>
        <div className="text-muted-foreground">{formatInt(c.clicks)} cliques</div>
      </div>
    </div>
  );
}

function NewClientDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    kind: "empresa" as "empresa" | "pessoa",
    document: "",
    email: "",
    phone: "",
    company: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name: form.name,
        kind: form.kind,
        document: form.document || null,
        email: form.email || null,
        phone: form.phone || null,
        company: form.company || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clients"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 grid place-items-center p-6" onClick={onClose}>
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-lg p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">Novo Cliente</h2>
          <p className="text-xs text-muted-foreground">Clientes antigos permanecem como histórico.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome / Razão social">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </Field>
          <Field label="Tipo">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="empresa">Empresa</option>
              <option value="pessoa">Pessoa</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="CPF / CNPJ">
            <input
              value={form.document}
              onChange={(e) => setForm({ ...form, document: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </Field>
          <Field label="Telefone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Empresa / Marca">
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Observações">
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
            {create.isPending ? "Salvando..." : "Cadastrar"}
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
