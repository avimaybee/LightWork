-- Image Versioning Migration
-- Adds parent_id and version columns to images table

-- Add parent_id column to reference the original/previous version
ALTER TABLE images ADD COLUMN parent_id TEXT REFERENCES images(id);

-- Add version column to track version number
ALTER TABLE images ADD COLUMN version INTEGER DEFAULT 1;

-- Add generated_prompt to track what prompt produced the result (separate from draft prompt)
ALTER TABLE images ADD COLUMN generated_prompt TEXT;

-- Create index for efficient version tree queries
CREATE INDEX IF NOT EXISTS idx_images_parent ON images(parent_id);
