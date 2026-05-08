-- Migration: Add digital signature fields to Consent table
-- Run this in Supabase SQL editor or via prisma migrate

ALTER TABLE "Consent"
  ADD COLUMN IF NOT EXISTS "signToken"           TEXT,
  ADD COLUMN IF NOT EXISTS "signTokenExpiresAt"  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "signatureImageUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "signedPdfUrl"        TEXT;

-- Index for fast token lookups
CREATE UNIQUE INDEX IF NOT EXISTS "Consent_signToken_key" ON "Consent" ("signToken") WHERE "signToken" IS NOT NULL;

-- Supabase Storage bucket for consent files
-- Run this in Supabase dashboard > Storage, or via SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'consent-files',
  'consent-files',
  false,
  10485760,  -- 10 MB limit
  ARRAY['image/png', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service_role can insert/update/delete
-- (Read access is via signed URLs generated server-side)
CREATE POLICY "consent-files service_role insert" ON storage.objects
  FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'consent-files');

CREATE POLICY "consent-files service_role select" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'consent-files');

CREATE POLICY "consent-files service_role update" ON storage.objects
  FOR UPDATE TO service_role
  USING (bucket_id = 'consent-files');

CREATE POLICY "consent-files service_role delete" ON storage.objects
  FOR DELETE TO service_role
  USING (bucket_id = 'consent-files');
