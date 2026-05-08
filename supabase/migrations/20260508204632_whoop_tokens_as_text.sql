-- bytea → text (base64). Razón: Supabase JS devuelve bytea como string \x... hex,
-- lo que rompe el roundtrip de Buffer en TS. Guardar como base64 string es
-- predecible y no requiere parseo manual.
--
-- Las filas existentes pierden sus tokens descifrables (los datos quedan como
-- base64 de los bytes raw, que al pasar por encryptToken/decryptToken no encajan).
-- El usuario debe reconectar Whoop tras esta migración.

alter table public.whoop_connections
  alter column access_token_encrypted  type text using encode(access_token_encrypted, 'base64'),
  alter column refresh_token_encrypted type text using encode(refresh_token_encrypted, 'base64');

comment on column public.whoop_connections.access_token_encrypted
  is 'Base64-encoded AES-256-GCM ciphertext (iv 12 || tag 16 || ciphertext). Cifrado en TS via @creed/whoop encryptToken.';
comment on column public.whoop_connections.refresh_token_encrypted
  is 'Base64-encoded AES-256-GCM ciphertext (iv 12 || tag 16 || ciphertext). Cifrado en TS via @creed/whoop encryptToken.';
