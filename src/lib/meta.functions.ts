// Server functions for Meta (Facebook/Instagram) Ads API sync.
// Requires META_ACCESS_TOKEN secret and ad_account_id stored in meta_integration table.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GRAPH = "https://graph.facebook.com/v21.0";

type FbCampaign = {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget?: string;
  insights?: {
    data?: Array<{
      spend?: string;
      clicks?: string;
      impressions?: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  };
};

async function getToken() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("meta_tokens").select("access_token").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.access_token ?? process.env.META_ACCESS_TOKEN;
}

export const getMetaAuthUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { origin: string }) => z.object({ origin: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const appId = process.env.META_APP_ID;
    if (!appId) return { ok: false as const, error: "App da Meta ainda não configurado (META_APP_ID / META_APP_SECRET)." };
    const redirect = `${data.origin}/api/public/meta/callback`;
    const scope = "ads_read,business_management,pages_show_list,instagram_basic,read_insights";
    return { ok: true as const, url: `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirect)}&scope=${scope}` };
  });

export const syncMetaCampaigns = createServerFn({ method: "POST" }).handler(async () => {
  const token = await getToken();
  if (!token) {
    return { ok: false as const, error: "Conecte sua conta Meta em Integrações." };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: cfg } = await supabaseAdmin
    .from("meta_integration")
    .select("ad_account_id")
    .limit(1)
    .maybeSingle();

  const adAccountId = (cfg as { ad_account_id?: string } | null)?.ad_account_id;
  if (!adAccountId) {
    return { ok: false as const, error: "ID da conta de anúncios não configurado." };
  }

  const acct = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const url = `${GRAPH}/${acct}/campaigns?fields=id,name,status,objective,daily_budget,insights.date_preset(last_30d){spend,clicks,impressions,actions}&limit=50&access_token=${encodeURIComponent(token)}`;

  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) {
    return { ok: false as const, error: body?.error?.message ?? `Meta API erro ${res.status}` };
  }

  const campaigns: FbCampaign[] = body.data ?? [];
  let upserted = 0;
  for (const c of campaigns) {
    const ins = c.insights?.data?.[0];
    const conversions = ins?.actions?.find((a) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase")?.value;
    const row = {
      name: c.name,
      platform: "both",
      objective: c.objective ?? null,
      status: c.status?.toLowerCase() === "active" ? "active" : c.status?.toLowerCase() === "paused" ? "paused" : "archived",
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
      spend: ins?.spend ? Number(ins.spend) : 0,
      clicks: ins?.clicks ? Number(ins.clicks) : 0,
      impressions: ins?.impressions ? Number(ins.impressions) : 0,
      conversions: conversions ? Number(conversions) : 0,
      meta_campaign_id: c.id,
    };
    const { data: existing } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("meta_campaign_id", c.id)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("campaigns").update(row).eq("id", (existing as { id: string }).id);
    } else {
      await supabaseAdmin.from("campaigns").insert(row);
    }
    upserted++;
  }

  await supabaseAdmin
    .from("meta_integration")
    .update({ last_sync_at: new Date().toISOString(), is_connected: true })
    .eq("ad_account_id", adAccountId);

  return { ok: true as const, count: upserted };
});

export const testMetaConnection = createServerFn({ method: "POST" })
  .inputValidator((d: { ad_account_id: string }) => z.object({ ad_account_id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const token = await getToken();
    if (!token) return { ok: false as const, error: "Conecte sua conta Meta primeiro." };
    const acct = data.ad_account_id.startsWith("act_") ? data.ad_account_id : `act_${data.ad_account_id}`;
    const res = await fetch(`${GRAPH}/${acct}?fields=name,account_status,currency&access_token=${encodeURIComponent(token)}`);
    const body = await res.json();
    if (!res.ok) return { ok: false as const, error: body?.error?.message ?? `Erro ${res.status}` };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("meta_integration").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabaseAdmin.from("meta_integration").insert({
      ad_account_id: data.ad_account_id,
      account_name: body.name,
      is_connected: true,
      connected_at: new Date().toISOString(),
    });
    return { ok: true as const, name: body.name, currency: body.currency };
  });
