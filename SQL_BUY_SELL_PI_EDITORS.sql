-- Add allowlist for users who can update Pi buy/sell prices (besides admins).
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS pi_exchange_editor_ids text[] DEFAULT '{}'::text[];
