-- GiftMap Database Schema
-- Run with: psql -U postgres -d giftmap -f schema.sql
-- Creates all tables from scratch. Safe to run on a fresh database.

-- Enable UUID generation (required for gen_random_uuid())
-- This extension is available by default on most PostgreSQL installations
-- including Render's managed PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── USERS ──────────────────────────────────────────────────────────────
-- Core account table. Passwords are stored as bcrypt hashes only —
-- the plain password never touches the database.
CREATE TABLE IF NOT EXISTS users (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  fullname      VARCHAR(255),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── RECIPIENTS ─────────────────────────────────────────────────────────
-- People that users buy gifts for. Each recipient belongs to one user.
-- Deleting a user cascades to delete all their recipients automatically.
CREATE TABLE IF NOT EXISTS recipients (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  relationship      VARCHAR(100),         -- e.g. "partner", "mother", "colleague"
  date_of_birth     DATE,                 -- used to derive zodiac_sign automatically
  zodiac_sign       VARCHAR(20),          -- derived from date_of_birth, never set directly
  personality_notes TEXT,                 -- free text: likes, dislikes, interests
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── GIFT SEARCHES ──────────────────────────────────────────────────────
-- Each AI gift search result, linked to both a user and a recipient.
-- suggestions stores the full JSON-stringified AI response.
CREATE TABLE IF NOT EXISTS gift_searches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES recipients(id) ON DELETE CASCADE,
  occasion     VARCHAR(100) NOT NULL,
  budget       INTEGER NOT NULL,
  suggestions  TEXT NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);