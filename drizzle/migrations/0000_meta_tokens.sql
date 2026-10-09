CREATE TABLE public.meta_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), access_token text NOT NULL, expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.meta_tokens TO service_role;
ALTER TABLE public.meta_tokens ENABLE ROW LEVEL SECURITY;