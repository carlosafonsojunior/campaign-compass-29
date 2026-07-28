import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState, useMemo } from "react";
import { toast } from "sonner";
import type { Creative, Client, Campaign } from "@/lib/types";
import { Upload, Trash2, Play, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/criativos")({
  component: CreativesPage,
  head: () => ({
    meta: [
      { title: "Criativos por Cliente | Velocity Ads" },
      { name: "description", content: "Biblioteca de vídeos para tráfego pago organizada por cliente com campanha ativa." },
      { property: "og:title", content: "Criativos por Cliente | Velocity Ads" },
      { property: "og:description", content: "Biblioteca de vídeos para tráfego pago organizada por cliente com campanha ativa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CreativesPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [clientId, setClientId] = useState("");

  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data } = await supabase.from("creatives").select("*").order("created_at", { ascending: false });
      return (data ?? []) as unknown as Creative[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").order("name");
      return (data ?? []) as Client[];
    },
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*");
      return (data ?? []) as Campaign[];
    },
  });

  // Apenas clientes que possuem ao menos uma campanha ativa
  const eligible = useMemo(() => {
    const withActive = new Set(
      campaigns.filter((c) => c.status === "active" && c.client_id).map((c) => c.client_id as string),
    );
    return clients.filter((c) => withActive.has(c.id));
  }, [clients, campaigns]);

  const selected = eligible.find((c) => c.id === clientId) ?? null;
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "Sem cliente";

  const visible = clientId ? creatives.filter((c) => c.client_id === clientId) : creatives;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!selected) {
      toast.error("Selecione um cliente com campanha ativa antes de enviar vídeos");
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("creatives").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: signed } = await supabase.storage.from("creatives").createSignedUrl(path, 60 * 60 * 24 * 365);
        const publicUrl = signed?.signedUrl ?? "";
        const { error: insErr } = await supabase.from("creatives").insert({
          title: file.name.replace(/\.[^.]+$/, ""),
          storage_path: path,
          public_url: publicUrl,
          size_bytes: file.size,
          mime_type: file.type,
          client_id: selected.id,
        } as never);
        if (insErr) throw insErr;
      }
      toast.success(`${files.length} vídeo(s) enviado(s) para ${selected.name}`);
      qc.invalidateQueries({ queryKey: ["creatives"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const del = useMutation({
    mutationFn: async (c: Creative) => {
      await supabase.storage.from("creatives").remove([c.storage_path]);
      const { error } = await supabase.from("creatives").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vídeo removido");
      qc.invalidateQueries({ queryKey: ["creatives"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell
      title="Biblioteca de Criativos"
      subtitle={`${visible.length} vídeo${visible.length === 1 ? "" : "s"}${selected ? ` — ${selected.name}` : ""}`}
      actions={
        <>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="bg-background border border-border rounded-sm px-3 py-2 text-xs text-foreground outline-none focus:border-brand/50"
          >
            <option value="">Todos os clientes</option>
            {eligible.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || !selected}
            title={!selected ? "Selecione um cliente com campanha ativa" : undefined}
            className="px-4 py-2 text-xs font-semibold bg-brand text-primary-foreground rounded-sm hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed uppercase tracking-wider inline-flex items-center gap-2"
          >
            <Upload className="size-3.5" />
            {uploading ? "Enviando..." : "Upload vídeo"}
          </button>
        </>
      }
    >
      {eligible.length === 0 && (
        <div className="mb-6 flex items-start gap-3 border border-border bg-surface/50 rounded-lg p-4">
          <AlertCircle className="size-4 text-brand mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Nenhum cliente com campanha ativa. Cadastre um cliente e crie uma campanha ativa para ele antes de subir criativos.
          </p>
        </div>
      )}

      {visible.length === 0 ? (
        <div
          onClick={() => selected && inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg py-24 grid place-items-center cursor-pointer hover:border-brand/50 transition-colors"
        >
          <div className="text-center space-y-2">
            <Upload className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-foreground font-semibold">
              {selected ? `Envie vídeos para ${selected.name}` : "Selecione um cliente com campanha ativa"}
            </p>
            <p className="text-xs text-muted-foreground">MP4, MOV, WEBM — qualquer tamanho</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {visible.map((c) => (
            <div key={c.id} className="space-y-2 group">
              <div className="w-full aspect-[4/5] bg-surface outline-1 -outline-offset-1 outline-border rounded-md overflow-hidden relative">
                <video
                  src={c.public_url}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center">
                  <Play className="size-8 text-brand" />
                </div>
                <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-background/80 border border-border rounded text-brand">
                  {clientName(c.client_id)}
                </span>
                <button
                  onClick={() => confirm(`Remover "${c.title}"?`) && del.mutate(c)}
                  className="absolute top-2 right-2 size-7 grid place-items-center bg-background/80 border border-border rounded-md text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-foreground truncate">{c.title}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {c.mime_type?.split("/")[1] ?? "video"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
