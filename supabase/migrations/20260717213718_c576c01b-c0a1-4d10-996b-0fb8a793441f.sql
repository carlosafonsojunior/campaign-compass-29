
CREATE POLICY "Public read creatives objects" ON storage.objects FOR SELECT USING (bucket_id = 'creatives');
CREATE POLICY "Public insert creatives objects" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'creatives');
CREATE POLICY "Public delete creatives objects" ON storage.objects FOR DELETE USING (bucket_id = 'creatives');
