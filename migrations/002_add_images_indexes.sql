-- Migration: Add performance indexes for images table
-- Date: 2024-12-29
-- This migration adds critical indexes for better query performance

-- Index on images.job_id (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_images_job_id ON images(job_id);

-- Index on images.status (for filtering by processing state)
CREATE INDEX IF NOT EXISTS idx_images_status ON images(status);

-- Combined index for batch operations (filter by job + status)
CREATE INDEX IF NOT EXISTS idx_images_job_status ON images(job_id, status);
