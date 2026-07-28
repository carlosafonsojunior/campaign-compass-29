CREATE TABLE public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'empresa',
  document text,
  email text,
  phone text,
  company text,
  notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO anon, authenticated;
GRANT ALL ON public.clients TO service_role;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Public insert clients" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update clients" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public delete clients" ON public.clients FOR DELETE USING (true);

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaigns ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX idx_campaigns_client_id ON public.campaigns(client_id);