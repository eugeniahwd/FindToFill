-- FindToFill: storage buckets and policies.
-- report-photos: PRIVATE. Path {user_id}/{uuid}.jpg. Uploaded through a server route
--   that validates type and size; read through 1-hour signed URLs created server-side.
-- layouts: public read, admin write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-photos', 'report-photos', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('layouts',       'layouts',       true,  5242880, array['image/jpeg','image/png','image/webp','image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- report-photos: a user may upload only into their own folder and read their own files.
create policy "report-photos: insert own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "report-photos: read own or admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
create policy "report-photos: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'report-photos' and public.is_admin());

-- layouts: anyone can read (public URL, list, and the select that upsert needs); only admins write.
create policy "layouts: public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'layouts');
create policy "layouts: admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'layouts' and public.is_admin());
create policy "layouts: admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'layouts' and public.is_admin())
  with check (bucket_id = 'layouts' and public.is_admin());
create policy "layouts: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'layouts' and public.is_admin());
