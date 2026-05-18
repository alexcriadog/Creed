-- chat-attachments: imágenes y documentos adjuntos a mensajes del chat con
-- los coaches. Bucket privado + tabla con metadatos y texto extraído para
-- PDFs. RLS por user_id en ambas capas.
-- Convención de path: {user_id}/{conversation_id}/{ts}-{slug}.{ext}

-- ------------------------------------------------------------------
-- Tabla de metadatos
-- ------------------------------------------------------------------
create table if not exists message_attachments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  message_id      uuid references messages(id) on delete cascade,
  kind            text not null check (kind in ('image', 'document')),
  storage_path    text not null,
  mime_type       text not null,
  original_filename text,
  size_bytes      int not null check (size_bytes > 0),
  page_count      int check (page_count is null or page_count > 0),
  extracted_text  text,
  created_at      timestamptz not null default now()
);

create index if not exists message_attachments_user_created_idx
  on message_attachments (user_id, created_at desc);
create index if not exists message_attachments_message_idx
  on message_attachments (message_id) where message_id is not null;
create index if not exists message_attachments_conversation_idx
  on message_attachments (conversation_id);

alter table message_attachments enable row level security;

drop policy if exists message_attachments_self_select on message_attachments;
create policy message_attachments_self_select on message_attachments
  for select using (user_id = auth.uid());

drop policy if exists message_attachments_self_insert on message_attachments;
create policy message_attachments_self_insert on message_attachments
  for insert with check (user_id = auth.uid());

drop policy if exists message_attachments_self_update on message_attachments;
create policy message_attachments_self_update on message_attachments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists message_attachments_self_delete on message_attachments;
create policy message_attachments_self_delete on message_attachments
  for delete using (user_id = auth.uid());

-- ------------------------------------------------------------------
-- Bucket de storage
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', false)
on conflict (id) do nothing;

drop policy if exists chat_attachments_self_select on storage.objects;
create policy chat_attachments_self_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists chat_attachments_self_insert on storage.objects;
create policy chat_attachments_self_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists chat_attachments_self_update on storage.objects;
create policy chat_attachments_self_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists chat_attachments_self_delete on storage.objects;
create policy chat_attachments_self_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
