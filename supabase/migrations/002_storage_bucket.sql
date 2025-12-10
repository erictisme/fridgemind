-- Create storage bucket for fridge photos
-- Run this in Supabase SQL Editor

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fridge-photos',
  'fridge-photos',
  false, -- private bucket
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
) ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload to their own folder
-- Files should be stored as: {user_id}/filename.jpg
CREATE POLICY "Users can upload own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'fridge-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow users to view their own photos
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'fridge-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow users to delete their own photos
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'fridge-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
