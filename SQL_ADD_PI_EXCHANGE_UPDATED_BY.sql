-- Add 'pi_exchange_updated_by' to store the last editor (users.id or pi_users.id).
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS pi_exchange_updated_by uuid;
