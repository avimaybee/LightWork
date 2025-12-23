-- LightWork Database Schema
-- Compatible with existing bananabatch-db

-- Jobs table (Projects/Sessions)
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
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
    name TEXT NOT NULL,
    prompt TEXT,
    category TEXT DEFAULT 'custom'
);
