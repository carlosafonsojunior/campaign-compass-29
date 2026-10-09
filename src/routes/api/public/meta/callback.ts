import { createFileRoute } from "@tanstack/react-router";

const GRAPH = "https://graph.facebook.com/v21.0";

export const Route = createFileRoute("/api/public/meta/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const back = (msg: string) =>
          new Response(null, { status: 302, headers: { Location: `/integracoes?meta=${encodeURIComponent(msg)}` } });
        const code = url.searchParams.get("code");
        if (!code) return back(url.searchParams.get("error_description") ?? "cancelado");
        const appId = process.env.META_APP_ID;
        const secret = process.env.META_APP_SECRET;
        if (!appId || !secret) return back("app_meta_nao_configurado");
        const redirect = `${url.origin}/api/public/meta/callback`;

        const r1 = await fetch(`${GRAPH}/oauth/access_token?client_id=${appId}&client_secret=${secret}&redirect_uri=${encodeURIComponent(redirect)}&code=${code}`);
        const t1 = await r1.json();
        if (!r1.ok) return back(t1?.error?.message ?? "erro_token");
        const r2 = await fetch(`${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}&fb_exchange_token=${t1.access_token}`);
        const t2 = r2.ok ? await r2.json() : t1;
        const token: string = t2.access_token;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("meta_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabaseAdmin.from("meta_tokens").insert({
          access_token: token,
          expires_at: t2.expires_in ? new Date(Date.now() + t2.expires_in * 1000).toISOString() : null,
        });

        const ra = await fetch(`${GRAPH}/me/adaccounts?fields=account_id,name&limit=1&access_token=${token}`);
        const acc = ra.ok ? (await ra.json()).data?.[0] : null;
        await supabaseAdmin.from("meta_integration").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabaseAdmin.from("meta_integration").insert({
          ad_account_id: acc?.account_id ?? null,
          account_name: acc?.name ?? "Conta Meta",
          is_connected: true,
          connected_at: new Date().toISOString(),
        });
        return back("ok");
      },
    },
  },
});
