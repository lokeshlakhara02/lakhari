-- Add attachments and emoji support to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachments JSON DEFAULT '[]',
ADD COLUMN IF NOT EXISTS has_emoji BOOLEAN DEFAULT FALSE;
