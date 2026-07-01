-- ============================================================
-- GIFTMAP DATABASE SCHEMA
-- ============================================================
-- Complete schema for GiftMap platform (Wakadobe Africa)
-- Covers Sprint 1, 2, 2.5, and 3A
--
-- HOW TO USE:
-- Fresh database setup:
--   psql -U postgres -d giftmap -f schema.sql
--
-- Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS
-- throughout so it is safe to run multiple times without
-- errors or data loss on an existing database.
--
-- RENDER SETUP:
-- Connect using the External Database URL from your
-- Render PostgreSQL dashboard, then run:
--   psql YOUR_RENDER_EXTERNAL_URL -f schema.sql
-- ============================================================


-- EXTENSIONS
-- pgcrypto provides gen_random_uuid() for UUID generation.
-- Available by default on Render managed PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- USERS
-- Core account table shared by ALL user types on the platform.
-- A single users table with a role column is intentional:
-- one login system, one JWT flow, one auth codebase.
--
-- role values:
--   user          = regular gift buyer (default)
--   admin         = platform administrator
--   store_manager = supermarket/store owner
--
-- Passwords stored as bcrypt hashes only.
-- Plain text password never touches the database.
CREATE TABLE IF NOT EXISTS users (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  fullname      VARCHAR(255),
  role          VARCHAR(20)  DEFAULT 'user' NOT NULL,
  created_at    TIMESTAMP    DEFAULT NOW()
);

-- Role constraint: rejects invalid role values at the database
-- level before they cause silent bugs in application code.
-- Wrapped in DO block so re-running on an existing database
-- that already has this constraint does not throw an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_role'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT valid_role
    CHECK (role IN ('user', 'admin', 'store_manager'));
  END IF;
END $$;


-- STORES
-- One store per store_manager user.
-- UNIQUE on user_id enforces the one-store-per-manager rule.
--
-- is_active defaults to false. New stores are invisible to
-- the AI and to gift buyers until an admin approves them.
-- This is the platform quality gate against fake listings.
--
-- is_verified is separate from is_active:
--   is_active  = visible and usable in the platform
--   is_verified = admin confirmed RC number and TIN are
--                 legitimate via manual CAC register check
--
-- Business verification fields are nullable because not every
-- legitimate small Nigerian business has completed formal CAC
-- registration. Admin can approve for basic listing first,
-- then mark is_verified true once documents are confirmed.
CREATE TABLE IF NOT EXISTS stores (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID         UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  address       TEXT,
  city          VARCHAR(100),
  phone         VARCHAR(20),
  logo_url      TEXT,
  business_name VARCHAR(255),
  rc_number     VARCHAR(50),
  tin           VARCHAR(50),
  is_active     BOOLEAN      DEFAULT false,
  is_verified   BOOLEAN      DEFAULT false,
  created_at    TIMESTAMP    DEFAULT NOW()
);


-- CATEGORIES
-- Fixed set of product categories shared across all stores.
-- A separate table not a free-text column on products ensures
-- every store uses the same category names so the AI can
-- query reliably without string matching issues.
--
-- name  = machine-readable identifier used in code and queries
-- label = human-readable display name shown in the UI
-- icon  = single emoji for quick visual recognition
CREATE TABLE IF NOT EXISTS categories (
  id    UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  name  VARCHAR(100) UNIQUE NOT NULL,
  label VARCHAR(150) NOT NULL,
  icon  VARCHAR(10)
);

-- Seed default categories.
-- ON CONFLICT DO NOTHING: re-running this file on a database
-- that already has these categories does not duplicate rows.
INSERT INTO categories (name, label, icon) VALUES
  ('chocolate',  'Chocolate & Confectionery', '🍫'),
  ('beverages',  'Beverages',                 '🥤'),
  ('snacks',     'Snacks',                    '🍿'),
  ('cosmetics',  'Beauty & Cosmetics',        '💄'),
  ('biscuits',   'Biscuits & Cookies',        '🍪'),
  ('coffee',     'Coffee',                    '☕'),
  ('tea',        'Tea',                       '🍵'),
  ('wellness',   'Wellness & Self-Care',      '🧘'),
  ('tech',       'Tech Accessories',          '🎧'),
  ('fashion',    'Fashion & Accessories',     '👜'),
  ('home',       'Home & Decor',              '🏠'),
  ('stationery', 'Stationery & Books',        '📓')
ON CONFLICT (name) DO NOTHING;


-- PRODUCTS
-- Real inventory uploaded by store managers.
-- This table replaces the Open Food Facts external API entirely.
-- The AI now queries this table directly, not an external source.
--
-- store_id ON DELETE CASCADE: deleting a store removes all its
-- products automatically, preventing orphaned records.
--
-- category_id ON DELETE SET NULL: if a category is removed,
-- products lose their categorisation but are NOT deleted.
-- An admin can re-categorise them rather than losing records.
--
-- price is stored as a whole Naira integer.
-- e.g. 4500 means N4,500. Consistent with gift_searches.budget.
-- Avoids floating point precision issues for monetary values
-- and makes direct budget-to-price comparisons simple.
--
-- in_stock: toggled frequently by store managers as items
-- sell out. When false, excluded from all AI suggestions.
--
-- is_approved: admin moderation lever. A product can be
-- hidden without deleting it, preserving the record for
-- review and potential reinstatement.
--
-- updated_at: tracks the last price or stock change.
CREATE TABLE IF NOT EXISTS products (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     UUID         REFERENCES stores(id) ON DELETE CASCADE,
  category_id  UUID         REFERENCES categories(id) ON DELETE SET NULL,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  price        INTEGER      NOT NULL,
  image_url    TEXT,
  in_stock     BOOLEAN      DEFAULT true,
  is_approved  BOOLEAN      DEFAULT true,
  created_at   TIMESTAMP    DEFAULT NOW(),
  updated_at   TIMESTAMP    DEFAULT NOW()
);

-- Index for the AI inventory query: find all products in a
-- given category that are in stock and approved.
-- Without this PostgreSQL scans every row on each fetch.
-- Fine at 100 rows, slow at 100,000 across many stores.
CREATE INDEX IF NOT EXISTS idx_products_category_stock
ON products (category_id, in_stock, is_approved);

-- Index for store dashboard: show all MY products
CREATE INDEX IF NOT EXISTS idx_products_store
ON products (store_id);


-- RECIPIENTS
-- People that users buy gifts for.
-- Each recipient belongs to one user.
--
-- All profile fields are nullable. Users build up profiles
-- over time and are never blocked from searching because a
-- field is missing. Each field improves AI suggestion quality
-- when present but absence never blocks the search.
--
-- zodiac_sign is derived automatically from date_of_birth
-- by recipientsService.js (deriveZodiacSign function).
-- Never set directly by the frontend.
-- Stored to avoid recalculating on every gift search.
CREATE TABLE IF NOT EXISTS recipients (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID         REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  relationship      VARCHAR(100),
  date_of_birth     DATE,
  zodiac_sign       VARCHAR(20),
  personality_notes TEXT,
  gender            VARCHAR(20),
  created_at        TIMESTAMP    DEFAULT NOW()
);


-- GIFT SEARCHES
-- Each AI gift search result, linked to a user and recipient.
--
-- suggestions stores the full AI response as a JSON string.
-- JSON.stringify on save, JSON.parse on read.
-- Handled entirely in the application layer.
--
-- recipient_id is nullable: a user can run a search without
-- saving to a named recipient profile. In practice saving
-- always links to a recipient but the schema does not enforce
-- this so the app never errors on a missing recipient_id.
--
-- budget is stored as a whole Naira integer, consistent with
-- products.price for direct comparisons without unit conversion.
CREATE TABLE IF NOT EXISTS gift_searches (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID         REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID         REFERENCES recipients(id) ON DELETE CASCADE,
  occasion     VARCHAR(100) NOT NULL,
  budget       INTEGER      NOT NULL,
  suggestions  TEXT         NOT NULL,
  created_at   TIMESTAMP    DEFAULT NOW()
);


-- ============================================================
-- FUTURE TABLES (planned for Sprint 3C)
-- ============================================================
--
-- orders
--   id               UUID PK
--   user_id          references users
--   gift_search_id   references gift_searches
--   store_id         references stores
--   recipient_name   VARCHAR(255)
--   delivery_address TEXT
--   delivery_phone   VARCHAR(20)
--   total_amount     INTEGER (whole Naira)
--   delivery_fee     INTEGER (whole Naira)
--   status           VARCHAR(50) DEFAULT 'pending'
--   tracking_code    TEXT
--   logistics_ref    TEXT (reference from logistics partner API)
--   created_at       TIMESTAMP
--
-- ============================================================