ALTER TABLE public.creatives ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS creatives_client_id_idx ON public.creatives(client_id);
GRANT UPDATE ON public.creatives TO anon, authenticated;
GRANT ALL ON public.creatives TO service_role;
CREATE POLICY "Public update creatives" ON public.creatives FOR UPDATE USING (true) WITH CHECK (true);