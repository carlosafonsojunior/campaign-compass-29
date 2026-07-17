
-- Campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('facebook','instagram','both')),
  objective TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  daily_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  meta_campaign_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO anon, authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read campaigns" ON public.campaigns FOR SELECT USING (true);
CREATE POLICY "Public insert campaigns" ON public.campaigns FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update campaigns" ON public.campaigns FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete campaigns" ON public.campaigns FOR DELETE USING (true);

-- Daily metrics for charts
CREATE TABLE public.campaign_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_metrics TO anon, authenticated;
GRANT ALL ON public.campaign_metrics TO service_role;
ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read metrics" ON public.campaign_metrics FOR SELECT USING (true);
CREATE POLICY "Public insert metrics" ON public.campaign_metrics FOR INSERT WITH CHECK (true);

-- Creative videos
CREATE TABLE public.creatives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatives TO anon, authenticated;
GRANT ALL ON public.creatives TO service_role;
ALTER TABLE public.creatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read creatives" ON public.creatives FOR SELECT USING (true);
CREATE POLICY "Public insert creatives" ON public.creatives FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete creatives" ON public.creatives FOR DELETE USING (true);

-- Meta integration config (single row)
CREATE TABLE public.meta_integration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_account_id TEXT,
  account_name TEXT,
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_integration TO anon, authenticated;
GRANT ALL ON public.meta_integration TO service_role;
ALTER TABLE public.meta_integration ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read meta" ON public.meta_integration FOR SELECT USING (true);
CREATE POLICY "Public insert meta" ON public.meta_integration FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update meta" ON public.meta_integration FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete meta" ON public.meta_integration FOR DELETE USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed some sample metrics for empty state
