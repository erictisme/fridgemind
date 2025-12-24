-- Create storage bucket for meal photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-photos', 'meal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload meal photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own photos
CREATE POLICY "Users can view own meal photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (for sharing/display)
CREATE POLICY "Public can view meal photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meal-photos');

-- Allow users to delete their own photos
CREATE POLICY "Users can delete own meal photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
