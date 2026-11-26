-- Performance indexes for media table
-- Run in Supabase SQL Editor or via CLI: supabase db push

-- 1. Slideshow & gallery: fetch approved media ordered by taken_at
CREATE INDEX IF NOT EXISTS idx_media_event_taken_at
  ON media (event_id, taken_at DESC)
  WHERE is_approved = true;

-- 2. Guest filtering & GDPR delete: find all media for a guest in an event
CREATE INDEX IF NOT EXISTS idx_media_event_guest
  ON media (event_id, guest_id);

-- 3. Moderation queue: fetch pending (unapproved) media for an event
CREATE INDEX IF NOT EXISTS idx_media_event_approved
  ON media (event_id, is_approved)
  WHERE is_approved = false;

-- 4. Cover photo lookup (optional, if you query by cover_url)
-- CREATE INDEX IF NOT EXISTS idx_media_cover_url ON media (cover_url) WHERE cover_url IS NOT NULL;