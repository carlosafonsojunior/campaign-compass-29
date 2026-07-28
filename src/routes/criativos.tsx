import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { supabase } from "@/integrations/supabase/client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Creative } from "@/lib/types";
import { Upload, Trash2, Play } from "lucide-react";

export const Route = createFileRoute("/criativos")({
  component: CreativesPage,
});

function CreativesPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: creatives = [] } = useQuery({
    queryKey: ["creatives"],
    queryFn: async () => {
      const { data } = await supabase.from("creatives").select("*").order("created_at", { ascending: false });
      return (data ?? []) as Creative[];
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
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
        });
        if (insErr) throw insErr;
      }
      toast.success(`${files.length} vídeo(s) enviado(s)`);
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
      subtitle={`${creatives.length} vídeo${creatives.length === 1 ? "" : "s"} para tráfego pago`}
      actions={
        <>
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
            disabled={uploading}
            className="px-4 py-2 text-xs font-semibold bg-brand text-primary-foreground rounded-sm hover:bg-brand/90 disabled:opacity-50 uppercase tracking-wider inline-flex items-center gap-2"
          >
            <Upload className="size-3.5" />
            {uploading ? "Enviando..." : "Upload vídeo"}
          </button>
        </>
      }
    >
      {creatives.length === 0 ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg py-24 grid place-items-center cursor-pointer hover:border-brand/50 transition-colors"
        >
          <div className="text-center space-y-2">
            <Upload className="size-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-foreground font-semibold">Faça upload dos seus vídeos</p>
            <p className="text-xs text-muted-foreground">MP4, MOV, WEBM — qualquer tamanho</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4">
          {creatives.map((c) => (
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
