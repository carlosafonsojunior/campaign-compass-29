export const CAMPAIGN_OBJECTIVES = [
  "Reconhecimento de perfil",
  "Tráfego",
  "Engajamento",
  "Leads",
  "Promoção de app",
  "Vendas",
] as const;

export type Client = {
  id: string;
  name: string;
  kind: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  platform: "facebook" | "instagram" | "both";
  objective: string | null;
  status: "active" | "paused" | "archived";
  daily_budget: number;
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  meta_campaign_id: string | null;
  client_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};


export type Creative = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  public_url: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export type MetaIntegration = {
  id: string;
  ad_account_id: string | null;
  account_name: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  is_connected: boolean;
  created_at: string;
};

export function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);
}
export function formatInt(n: number) {
  return new Intl.NumberFormat("pt-BR").format(n || 0);
}
export function pct(a: number, b: number) {
  if (!b) return "0.00%";
  return `${((a / b) * 100).toFixed(2)}%`;
}
