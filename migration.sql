-- LightWork D1 Migration Script
-- Run this to add user support to existing database
-- Execute via: wrangler d1 execute bananabatch-db --file=./migration.sql

-- Step 1: Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,           -- Firebase UID
    email TEXT NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    created_at INTEGER,
    last_login INTEGER
);

-- Step 2: Add user_id column to jobs table
-- SQLite doesn't support IF NOT EXISTS for columns, so we use a workaround
-- This will fail silently if column already exists
ALTER TABLE jobs ADD COLUMN user_id TEXT REFERENCES users(id);

-- Step 3: Add user_id column to modules table
ALTER TABLE modules ADD COLUMN user_id TEXT REFERENCES users(id);

-- Step 4: Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_modules_user_id ON modules(user_id);

-- Step 5: Add updated_at column if not exists (for job tracking)
-- ALTER TABLE images ADD COLUMN updated_at INTEGER;

-- Note: Existing data will have NULL user_id
-- These records will not be visible to any user after migration
-- To migrate existing data to a specific user, run:
-- UPDATE jobs SET user_id = 'FIREBASE_UID' WHERE user_id IS NULL;
-- UPDATE modules SET user_id = 'FIREBASE_UID' WHERE user_id IS NULL;
