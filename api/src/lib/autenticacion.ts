/** Resolucion de la sesion y del contexto de reto en cada peticion. */

import { COOKIE_SESION, leerCookie, verificarSesion } from './jwt';
import { ErrorApi, noAutorizado, prohibido } from './respuestas';
import { participacionDe, perfilPorId, retoActivo } from './consultas';
import { hoyEn } from './fechas';
import type { Contexto, Env, Perfil } from '../tipos';

function tokenDe(peticion: Request): string | null {
  const cookie = leerCookie(peticion.headers.get('cookie'), COOKIE_SESION);
  if (cookie) return cookie;

  // Alternativa por cabecera: util para pruebas y clientes que no usan cookies.
  const cabecera = peticion.headers.get('authorization');
  return cabecera?.startsWith('Bearer ') ? cabecera.slice(7) : null;
}

export async function perfilDe(peticion: Request, env: Env): Promise<Perfil> {
  const token = tokenDe(peticion);
  if (!token) throw noAutorizado();

  const sesion = await verificarSesion(token, env.JWT_SECRET);
  if (!sesion) throw noAutorizado('Tu sesión venció, inicia de nuevo');

  const perfil = await perfilPorId(env, sesion.sub);
  if (!perfil) throw noAutorizado();

  // Cambiar la contrasena sube password_version y cierra las sesiones abiertas.
  if (perfil.password_version !== sesion.pv) {
    throw noAutorizado('Tu sesión venció, inicia de nuevo');
  }
  return perfil;
}

/** Perfil + reto activo + participacion. Lo que necesita casi toda la app. */
export async function contextoDe(perfil: Perfil, env: Env): Promise<Contexto> {
  const reto = await retoActivo(env);
  if (!reto) throw new ErrorApi(409, 'Todavía no hay un reto activo');

  const participacion = await participacionDe(env, reto.id, perfil.id);
  if (!participacion) throw prohibido('No estás inscrito en el reto activo');

  return { perfil, reto, participacion, hoy: hoyEn(env.ZONA_HORARIA) };
}

export function exigirAdmin(perfil: Perfil): void {
  if (perfil.es_admin !== 1) throw prohibido('Solo un administrador puede hacer esto');
}

/** En local se sirve por http, donde una cookie Secure no viajaria. */
export function esConexionSegura(peticion: Request): boolean {
  return new URL(peticion.url).protocol === 'https:';
}
