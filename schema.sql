-- LightWork Database Schema
-- Compatible with existing bananabatch-db

-- Users table (synced from Firebase Auth)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,           -- Firebase UID
    email TEXT NOT NULL,
    display_name TEXT,
    photo_url TEXT,
    created_at INTEGER,
    last_login INTEGER
);

-- Jobs table (Projects/Sessions)
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT,
    status TEXT DEFAULT 'active',
    module_prompt TEXT DEFAULT '',
    selected_mode TEXT DEFAULT 'fast',
    selected_module_preset TEXT DEFAULT '',
    created_at INTEGER
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    filename TEXT,
    r2_key_original TEXT,
    r2_key_result TEXT,
    prompt TEXT,
    error_msg TEXT,
    created_at INTEGER,
    FOREIGN KEY (job_id) REFERENCES jobs(id)
);

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    name TEXT NOT NULL,
    prompt TEXT,
    category TEXT DEFAULT 'custom'
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_modules_user_id ON modules(user_id);
