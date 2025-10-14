-- Add gender field to online_users table for gender-based matching
-- Migration 003: Add gender support

-- Add gender column to online_users table
ALTER TABLE online_users ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add comment for clarity
COMMENT ON COLUMN online_users.gender IS 'User gender for matching: male, female, or other';

-- Create index for gender-based queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_online_users_gender ON online_users(gender);

-- Create composite index for efficient gender + waiting status queries
CREATE INDEX IF NOT EXISTS idx_online_users_gender_waiting ON online_users(gender, is_waiting) WHERE is_waiting = true;
