/** Firma y verificacion de sesiones (JWT HS256 con WebCrypto). */

export interface Sesion {
  sub: string;  // id del perfil
  pv: number;   // password_version: cambiar la clave invalida las sesiones abiertas
  adm: boolean;
  iat: number;
  exp: number;
}

const DIAS_VIGENCIA = 30;

function aBase64Url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto: string): Uint8Array {
  const relleno = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(relleno + '='.repeat((4 - (relleno.length % 4)) % 4));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

function textoABytes(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

async function claveHmac(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textoABytes(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function firmarSesion(
  datos: { sub: string; pv: number; adm: boolean },
  secreto: string,
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo: Sesion = {
    ...datos,
    iat: ahora,
    exp: ahora + DIAS_VIGENCIA * 86_400,
  };

  const cabecera = aBase64Url(textoABytes(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const carga = aBase64Url(textoABytes(JSON.stringify(cuerpo)));
  const base = `${cabecera}.${carga}`;

  const firma = await crypto.subtle.sign('HMAC', await claveHmac(secreto), textoABytes(base));
  return `${base}.${aBase64Url(new Uint8Array(firma))}`;
}

export async function verificarSesion(token: string, secreto: string): Promise<Sesion | null> {
  const partes = token.split('.');
  if (partes.length !== 3) return null;

  const base = `${partes[0]}.${partes[1]}`;
  try {
    const valida = await crypto.subtle.verify(
      'HMAC',
      await claveHmac(secreto),
      deBase64Url(partes[2] as string) as BufferSource,
      textoABytes(base),
    );
    if (!valida) return null;

    const sesion = JSON.parse(new TextDecoder().decode(deBase64Url(partes[1] as string))) as Sesion;
    if (typeof sesion.exp !== 'number' || sesion.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof sesion.sub !== 'string' || !sesion.sub) return null;
    return sesion;
  } catch {
    return null;
  }
}

export const VIGENCIA_SEGUNDOS = DIAS_VIGENCIA * 86_400;
export const COOKIE_SESION = 'sesion';

/**
 * La sesion viaja en cookie HttpOnly: el Worker sirve la SPA desde el mismo
 * origen, asi que no hace falta exponer el token a JavaScript.
 * SameSite=Lax bloquea el envio en peticiones cross-site que muten datos.
 */
export function cookieSesion(token: string, seguro: boolean): string {
  const banderas = [
    `${COOKIE_SESION}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${VIGENCIA_SEGUNDOS}`,
  ];
  if (seguro) banderas.push('Secure');
  return banderas.join('; ');
}

export function cookieBorrada(seguro: boolean): string {
  const banderas = [`${COOKIE_SESION}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (seguro) banderas.push('Secure');
  return banderas.join('; ');
}

export function leerCookie(cabecera: string | null, nombre: string): string | null {
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const [clave, ...resto] = parte.trim().split('=');
    if (clave === nombre) return resto.join('=') || null;
  }
  return null;
}
