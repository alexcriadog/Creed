/**
 * Destino de retorno tras el login. Solo rutas internas absolutas ("/x"),
 * nunca esquemas ni protocol-relative ("//evil.com").
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

/** Añade ?next= a una ruta de login/verify si hay destino. */
export function withNext(path: string, next: string | null | undefined): string {
  const safe = safeNext(next);
  if (!safe) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}next=${encodeURIComponent(safe)}`;
}
