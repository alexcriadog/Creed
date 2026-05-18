-- meal-photos bucket: storage para fotos de comidas asociadas a meals.photo_path.
-- Privado, con RLS por user_id (primera carpeta del path).
-- Convención de path: {user_id}/{meal_id}/{filename}

insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Acceso self: cada usuario solo opera sobre archivos cuya primera carpeta
-- es su auth.uid().

drop policy if exists meal_photos_self_select on storage.objects;
create policy meal_photos_self_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists meal_photos_self_insert on storage.objects;
create policy meal_photos_self_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists meal_photos_self_update on storage.objects;
create policy meal_photos_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists meal_photos_self_delete on storage.objects;
create policy meal_photos_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'meal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
