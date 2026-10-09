import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { MetaIntegration } from "@/lib/types";
import { CheckCircle2, XCircle, RefreshCw, Facebook, Instagram, ExternalLink } from "lucide-react";
import { syncMetaCampaigns, testMetaConnection, getMetaAuthUrl } from "@/lib/meta.functions";

export const Route = createFileRoute("/integracoes")({
  component: IntegrationsPage,
});

function IntegrationsPage() {
  const qc = useQueryClient();
  const [adAccountId, setAdAccountId] = useState("");

  const { data: meta } = useQuery({
    queryKey: ["meta_integration"],
    queryFn: async () => {
      const { data } = await supabase.from("meta_integration").select("*").limit(1).maybeSingle();
      return data as MetaIntegration | null;
    },
  });

  const testFn = useServerFn(testMetaConnection);
  const syncFn = useServerFn(syncMetaCampaigns);
  const authFn = useServerFn(getMetaAuthUrl);
  const oauth = async () => {
    const r = await authFn({ data: { origin: window.location.origin } });
    if (!r.ok) return toast.error(r.error);
    window.location.href = r.url;
  };
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("meta");
    if (!m) return;
    if (m === "ok") toast.success("Conta Meta conectada!");
    else toast.error(`Falha ao conectar: ${m}`);
    window.history.replaceState({}, "", "/integracoes");
  }, []);

  const connect = useMutation({
    mutationFn: async () => {
      const id = adAccountId || meta?.ad_account_id;
      if (!id) throw new Error("Informe o ID da conta de anúncios");
      const res = await testFn({ data: { ad_account_id: id } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (r) => {
      toast.success(`Conectado à conta ${r.ok ? r.name : ""}`);
      qc.invalidateQueries({ queryKey: ["meta_integration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const res = await syncFn({});
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: (r) => {
      toast.success(`${r.ok ? r.count : 0} campanhas sincronizadas`);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["meta_integration"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!meta) return;
      const { error } = await supabase.from("meta_integration").update({ is_connected: false }).eq("id", meta.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Desconectado");
      qc.invalidateQueries({ queryKey: ["meta_integration"] });
    },
  });

  const connected = meta?.is_connected;

  return (
    <DashboardShell title="Integrações" subtitle="Conecte suas contas de mídia para sincronizar dados em tempo real">
      <div className="space-y-6 max-w-3xl">
        {/* Meta Ads Card */}
        <div className="bg-surface border border-border rounded-lg p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="size-12 rounded-lg bg-background border border-border grid place-items-center">
                <div className="flex -space-x-1">
                  <Facebook className="size-4 text-[#1877F2]" />
                  <Instagram className="size-4 text-[#E4405F]" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Meta Ads</h3>
                <p className="text-xs text-muted-foreground mt-1">Facebook + Instagram — sincroniza campanhas, gasto e cliques</p>
              </div>
            </div>
            <StatusPill connected={!!connected} />
          </div>

          {connected && meta && (
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
              <Info label="Conta" value={meta.account_name ?? "—"} />
              <Info label="Ad Account ID" value={meta.ad_account_id ?? "—"} mono />
              <Info
                label="Última sync"
                value={meta.last_sync_at ? new Date(meta.last_sync_at).toLocaleString("pt-BR") : "Nunca"}
              />
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={() => oauth()}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-[#1877F2] text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              <Facebook className="size-4" /> Conectar com Facebook
            </button>
            <button
              onClick={() => oauth()}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-primary-foreground text-sm font-semibold hover:opacity-90"
            >
              <Instagram className="size-4" /> Conectar com Instagram
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-3">Login com sua conta Meta — conecta Facebook e Instagram de uma vez. Ou informe o ID manualmente:</p>

          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                ID da Conta de Anúncios (Ad Account ID)
              </span>
              <input
                value={adAccountId || meta?.ad_account_id || ""}
                onChange={(e) => setAdAccountId(e.target.value)}
                placeholder="Ex: 1234567890 ou act_1234567890"
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:border-brand/50 outline-none"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
                className="px-4 py-2 text-xs font-bold bg-brand text-primary-foreground rounded-sm hover:bg-brand/90 disabled:opacity-50 uppercase tracking-wider"
              >
                {connect.isPending ? "Conectando..." : connected ? "Reconectar" : "Conectar Meta Ads"}
              </button>
              {connected && (
                <>
                  <button
                    onClick={() => sync.mutate()}
                    disabled={sync.isPending}
                    className="px-4 py-2 text-xs font-bold bg-foreground text-background rounded-sm hover:bg-foreground/90 disabled:opacity-50 uppercase tracking-wider inline-flex items-center gap-2"
                  >
                    <RefreshCw className={"size-3.5 " + (sync.isPending ? "animate-spin" : "")} />
                    Sincronizar Campanhas
                  </button>
                  <button
                    onClick={() => disconnect.mutate()}
                    className="px-4 py-2 text-xs font-bold text-destructive hover:underline uppercase tracking-wider"
                  >
                    Desconectar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-surface/50 border border-border rounded-lg p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Como conectar sua conta Meta Ads</h3>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <Step n={1}>
              Acesse o{" "}
              <a
                href="https://business.facebook.com/settings/ad-accounts"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline inline-flex items-center gap-1"
              >
                Gerenciador de Negócios <ExternalLink className="size-3" />
              </a>{" "}
              e copie o <span className="font-mono text-foreground">Ad Account ID</span> (aparece como <code className="text-foreground">act_1234...</code>).
            </Step>
            <Step n={2}>
              Gere um <span className="text-foreground font-semibold">Access Token</span> com permissões <code className="text-foreground">ads_read</code> em{" "}
              <a
                href="https://developers.facebook.com/tools/explorer/"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline inline-flex items-center gap-1"
              >
                developers.facebook.com <ExternalLink className="size-3" />
              </a>
              . Para produção, use um <span className="text-foreground">System User Token</span> (nunca expira).
            </Step>
            <Step n={3}>
              Adicione o token como secret <code className="text-foreground font-mono">META_ACCESS_TOKEN</code> nas configurações do backend. Peça no chat: <em className="text-foreground">"adicione o secret META_ACCESS_TOKEN"</em>.
            </Step>
            <Step n={4}>
              Cole o Ad Account ID acima, clique em <span className="text-foreground font-semibold">Conectar</span>, depois <span className="text-foreground font-semibold">Sincronizar Campanhas</span>.
            </Step>
          </ol>
        </div>

        {/* Coming soon */}
        <div className="bg-surface/30 border border-dashed border-border rounded-lg p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Em breve</h3>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <span className="px-2 py-1 border border-border rounded">Google Ads</span>
            <span className="px-2 py-1 border border-border rounded">TikTok Ads</span>
            <span className="px-2 py-1 border border-border rounded">LinkedIn Ads</span>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function StatusPill({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand bg-brand/10 border border-brand/30 rounded-full">
      <CheckCircle2 className="size-3" /> Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/40 border border-border rounded-full">
      <XCircle className="size-3" /> Desconectado
    </span>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      <div className={"text-sm text-foreground " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 size-6 rounded-full bg-background border border-border grid place-items-center text-xs font-bold text-brand">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
