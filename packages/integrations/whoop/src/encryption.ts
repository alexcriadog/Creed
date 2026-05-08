import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM con clave de 32 bytes desde WHOOP_TOKEN_ENCRYPTION_KEY (base64).
 *
 * Encrypt → string base64 (formato: iv 12 || tag 16 || ciphertext).
 * Decrypt → string original.
 *
 * Se guarda como text en Postgres (no bytea) para evitar líos de roundtrip
 * con Supabase JS que devuelve bytea como \x... hex.
 *
 * NOTA: si la key se pierde, los tokens guardados son irrecuperables.
 */

function getKey(): Buffer {
  const k = process.env.WHOOP_TOKEN_ENCRYPTION_KEY;
  if (!k) {
    throw new Error('WHOOP_TOKEN_ENCRYPTION_KEY env var not set');
  }
  const buf = Buffer.from(k, 'base64');
  if (buf.length !== 32) {
    throw new Error(
      `WHOOP_TOKEN_ENCRYPTION_KEY must be 32 bytes base64 (got ${buf.length})`,
    );
  }
  return buf;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptToken(encryptedBase64: string): string {
  const buf = Buffer.from(encryptedBase64, 'base64');
  if (buf.length < 28) {
    throw new Error('Invalid encrypted token: too short');
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
