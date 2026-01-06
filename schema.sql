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
    generated_prompt TEXT,         -- The prompt used to generate the result
    description TEXT,              -- AI-generated description for search indexing
    error_msg TEXT,
    parent_id TEXT,                -- Reference to parent image (for versioning)
    version INTEGER DEFAULT 1,     -- Version number (1 = original)
    created_at INTEGER,
    FOREIGN KEY (job_id) REFERENCES jobs(id),
    FOREIGN KEY (parent_id) REFERENCES images(id)
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
CREATE INDEX IF NOT EXISTS idx_images_job_id ON images(job_id);
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);
CREATE INDEX IF NOT EXISTS idx_modules_user_id ON modules(user_id);

-- Batch Jobs table (for Gemini Batch API)
CREATE TABLE IF NOT EXISTS batch_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    project_id TEXT REFERENCES jobs(id),
    gemini_batch_name TEXT,
    status TEXT DEFAULT 'pending',
    model TEXT,
    display_name TEXT,
    request_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    last_polled_at INTEGER,
    created_at INTEGER,
    submitted_at INTEGER,
    completed_at INTEGER
);

-- Batch Items table (individual images in a batch)
CREATE TABLE IF NOT EXISTS batch_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES batch_jobs(id),
    image_id TEXT REFERENCES images(id),
    request_key TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    result_data TEXT,
    error_msg TEXT,
    created_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_batch_jobs_user ON batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id);

-- Favorites table (User stored pinned modules)
CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT REFERENCES users(id),
    module_id TEXT NOT NULL,
    created_at INTEGER,
    PRIMARY KEY (user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
