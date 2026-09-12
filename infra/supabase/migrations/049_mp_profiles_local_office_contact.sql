-- 049_mp_profiles_local_office_contact.sql
-- Adds MP constituency-office contact fields, requested alongside the
-- postcode-based landing personalization in PR #202 ("show MP local office
-- details and contact" once a postcode resolves to a state).
--
-- Schema-only, deliberately. No source in this repo (or wired into
-- scripts/ingest_parliament/) currently pulls constituency-office address,
-- phone, or email — mp_profiles' only contact-adjacent field today is
-- parlimen_url (the MP's parlimen.gov.my profile page). Rather than
-- fabricate placeholder contact details (never done in this repo — see
-- CLAUDE.md's "never render a citation with fabricated data"), this
-- migration only widens the table so a follow-up ingestion pass (scraping
-- MyMP.org.my or parlimen.gov.my's own constituency-office listings, which
-- neither fetch_mp_roster.py nor seed_mp_profiles.py currently does) has
-- somewhere real to write. Every new column is nullable with no backfill;
-- until that ingestion exists, these columns stay NULL and the frontend
-- must render "no office info yet" rather than an empty string as if it
-- were a verified absence.

ALTER TABLE mp_profiles ADD COLUMN IF NOT EXISTS office_address text;
ALTER TABLE mp_profiles ADD COLUMN IF NOT EXISTS office_phone   text;
ALTER TABLE mp_profiles ADD COLUMN IF NOT EXISTS office_email   text;

-- No RLS change needed: mp_profiles already has a public-read policy from
-- migration 025 that covers all columns, including these new ones.
