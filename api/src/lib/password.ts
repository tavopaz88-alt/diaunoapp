/**
 * Hash de contrasenas con PBKDF2-HMAC-SHA256 sobre WebCrypto.
 *
 * bcrypt/argon2 necesitan modulos nativos que no existen en Workers. PBKDF2 si
 * esta en la plataforma y es una opcion aceptada para almacenamiento de claves.
 *
 * El formato guarda las iteraciones, asi que subirlas despues no invalida los
 * hashes viejos: se verifican con su propio parametro y se rehacen al entrar.
 */

const ITERACIONES_ACTUALES = 100_000;
const LARGO_BITS = 256;

function aBase64(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

function deBase64(texto: string): Uint8Array {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function derivar(clave: string, sal: Uint8Array, iteraciones: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(clave),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sal as BufferSource, iterations: iteraciones },
    material,
    LARGO_BITS,
  );
  return new Uint8Array(bits);
}

/** Devuelve `pbkdf2$sha256$<iteraciones>$<sal>$<hash>`. */
export async function hashearClave(clave: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivar(clave, sal, ITERACIONES_ACTUALES);
  return `pbkdf2$sha256$${ITERACIONES_ACTUALES}$${aBase64(sal)}$${aBase64(hash)}`;
}

/** Comparacion en tiempo constante: no filtra cuanto coincide por el tiempo. */
function igualesEnTiempoConstante(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= (a[i] as number) ^ (b[i] as number);
  return diferencia === 0;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const partes = guardado.split('$');
  if (partes.length !== 5 || partes[0] !== 'pbkdf2' || partes[1] !== 'sha256') return false;

  const iteraciones = Number(partes[2]);
  if (!Number.isFinite(iteraciones) || iteraciones < 1000) return false;

  try {
    const sal = deBase64(partes[3] as string);
    const esperado = deBase64(partes[4] as string);
    const obtenido = await derivar(clave, sal, iteraciones);
    return igualesEnTiempoConstante(obtenido, esperado);
  } catch {
    return false;
  }
}

/** true si el hash quedo con parametros viejos y conviene regenerarlo. */
export function necesitaRehash(guardado: string): boolean {
  return Number(guardado.split('$')[2]) !== ITERACIONES_ACTUALES;
}
