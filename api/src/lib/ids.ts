/** Identificadores. UUID v4 nativo del runtime. */
export function nuevoId(): string {
  return crypto.randomUUID();
}

/** Codigo de acceso al reto: legible en voz alta, sin caracteres ambiguos. */
export function nuevoCodigoAcceso(largo = 8): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin I, O, 0, 1
  const bytes = crypto.getRandomValues(new Uint8Array(largo));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('');
}

/** Token opaco para recuperacion de contrasena. */
export function nuevoToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest('SHA-256', datos);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
