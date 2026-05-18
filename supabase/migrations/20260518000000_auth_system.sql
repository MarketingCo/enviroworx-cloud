-- Migration: Auth System - Phase 2/3
-- Adds pin_hash columns, auth_user_id foreign keys, role columns,
-- processed_stripe_events table, and app_role enum.
-- Dated: 2026-05-18

-- ============================================================================
-- 1. Add pin_hash columns (hashed PIN storage, replacing plaintext)
-- ============================================================================

-- Add pin_hash to drivers table
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Add pin_hash to yard_staff table
ALTER TABLE yard_staff ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Add pin_hash to customers table (supersedes portal_pin)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- ============================================================================
-- 2. Add auth_user_id columns (link app records to Supabase Auth users)
-- ============================================================================

-- auth_user_id may already exist on drivers from earlier migration; skip safely
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Add auth_user_id to yard_staff if not exists
ALTER TABLE yard_staff
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- Add auth_user_id to customers if not exists
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- ============================================================================
-- 3. Add role column to drivers and yard_staff
-- ============================================================================

ALTER TABLE drivers ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'driver';
ALTER TABLE yard_staff ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'yard';

-- ============================================================================
-- 4. Create processed_stripe_events table (Phase 3 idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id TEXT PRIMARY KEY,        -- Stripe event ID
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. Create app_role enum
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE app_role AS ENUM ('office', 'driver', 'yard', 'customer');
EXCEPTION WHEN duplicate_object THEN
  -- Type already exists, nothing to do
  NULL;
END $$;

-- ============================================================================
-- 6. Drop old plaintext PIN columns — DEFERRED
-- ============================================================================
-- NOTE: Do NOT drop plaintext pin columns yet.
-- A follow-up migration will drop them after the app has been verified working.
-- ALTER TABLE drivers DROP COLUMN IF EXISTS pin;
-- ALTER TABLE yard_staff DROP COLUMN IF EXISTS pin;
-- ALTER TABLE customers DROP COLUMN IF EXISTS portal_pin;
