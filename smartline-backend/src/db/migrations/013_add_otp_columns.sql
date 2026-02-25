-- Columns on users table (already exist per schema, kept for completeness)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_otp_code TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_otp_message_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_otp_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_otp_status TEXT;

-- Standalone OTP table: works for new AND existing users (keyed by phone, not user id)
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  phone TEXT PRIMARY KEY,
  code TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_otp_verifications_status ON public.otp_verifications (status, sent_at);
