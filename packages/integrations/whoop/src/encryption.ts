import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM con clave de 32 bytes desde WHOOP_TOKEN_ENCRYPTION_KEY (base64).
 * Formato del bytea resultante: iv(12) || tag(16) || ciphertext
 *
 * NOTA: si la key se pierde, los tokens guardados son irrecuperables.
 * Documentado en docs/04-whoop-integration.md §7 y memoria privada.
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

export function encryptToken(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

export function decryptToken(encrypted: Buffer): string {
  if (encrypted.length < 28) {
    throw new Error('Invalid encrypted token: too short');
  }
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(12, 28);
  const data = encrypted.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
