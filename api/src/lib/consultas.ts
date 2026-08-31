/** Consultas compartidas a D1. Centralizadas para no repetir SQL en las rutas. */

import type {
  Env,
  Meta,
  Participacion,
  Perfil,
  RegistroSemanal,
  Reto,
} from '../tipos';

export async function perfilPorId(env: Env, id: string): Promise<Perfil | null> {
  return env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(id).first<Perfil>();
}

export async function perfilPorEmail(env: Env, email: string): Promise<Perfil | null> {
  return env.DB.prepare('SELECT * FROM profiles WHERE email = ?')
    .bind(email.toLowerCase())
    .first<Perfil>();
}

/** El reto activo. v1 maneja uno a la vez; el modelo ya soporta varios. */
export async function retoActivo(env: Env): Promise<Reto | null> {
  return env.DB.prepare(
    'SELECT * FROM retos WHERE activo = 1 ORDER BY fecha_inicio DESC LIMIT 1',
  ).first<Reto>();
}

export async function retoPorCodigo(env: Env, codigo: string): Promise<Reto | null> {
  return env.DB.prepare('SELECT * FROM retos WHERE codigo_acceso = ? AND activo = 1')
    .bind(codigo.trim().toUpperCase())
    .first<Reto>();
}

export async function participacionDe(
  env: Env,
  retoId: string,
  userId: string,
): Promise<Participacion | null> {
  return env.DB.prepare('SELECT * FROM participaciones WHERE reto_id = ? AND user_id = ?')
    .bind(retoId, userId)
    .first<Participacion>();
}

export async function metasDe(
  env: Env,
  retoId: string,
  userId: string,
  incluirArchivadas = true,
): Promise<Meta[]> {
  const filtro = incluirArchivadas ? '' : ' AND archivada = 0';
  const { results } = await env.DB.prepare(
    `SELECT * FROM metas WHERE reto_id = ? AND user_id = ?${filtro} ORDER BY orden, created_at`,
  )
    .bind(retoId, userId)
    .all<Meta>();
  return results ?? [];
}

export async function metaPorId(env: Env, id: string): Promise<Meta | null> {
  return env.DB.prepare('SELECT * FROM metas WHERE id = ?').bind(id).first<Meta>();
}

/**
 * Fechas cumplidas de cada participante del reto.
 * Incluye metas privadas y archivadas: la constancia se calcula sobre TODO
 * (seccion 7.2) y despues solo se expone el porcentaje, nunca el detalle.
 */
export async function diasCumplidosPorUsuario(
  env: Env,
  retoId: string,
): Promise<Map<string, Set<string>>> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT m.user_id AS user_id, d.fecha AS fecha
       FROM registros_diarios d
       JOIN metas m ON m.id = d.meta_id
      WHERE m.reto_id = ? AND d.cumplido = 1`,
  )
    .bind(retoId)
    .all<{ user_id: string; fecha: string }>();

  const mapa = new Map<string, Set<string>>();
  for (const fila of results ?? []) {
    let dias = mapa.get(fila.user_id);
    if (!dias) mapa.set(fila.user_id, (dias = new Set()));
    dias.add(fila.fecha);
  }
  return mapa;
}

/** Fechas cumplidas por meta, para las metas de una persona. */
export async function diasPorMeta(
  env: Env,
  retoId: string,
  userId: string,
): Promise<Map<string, Set<string>>> {
  const { results } = await env.DB.prepare(
    `SELECT d.meta_id AS meta_id, d.fecha AS fecha
       FROM registros_diarios d
       JOIN metas m ON m.id = d.meta_id
      WHERE m.reto_id = ? AND m.user_id = ? AND d.cumplido = 1`,
  )
    .bind(retoId, userId)
    .all<{ meta_id: string; fecha: string }>();

  const mapa = new Map<string, Set<string>>();
  for (const fila of results ?? []) {
    let dias = mapa.get(fila.meta_id);
    if (!dias) mapa.set(fila.meta_id, (dias = new Set()));
    dias.add(fila.fecha);
  }
  return mapa;
}

export async function semanalesDe(env: Env, metaIds: string[]): Promise<Map<string, RegistroSemanal[]>> {
  const mapa = new Map<string, RegistroSemanal[]>();
  if (metaIds.length === 0) return mapa;

  const marcadores = metaIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT * FROM registros_semanales
      WHERE meta_id IN (${marcadores})
      ORDER BY semana_inicio`,
  )
    .bind(...metaIds)
    .all<RegistroSemanal>();

  for (const fila of results ?? []) {
    const lista = mapa.get(fila.meta_id);
    if (lista) lista.push(fila);
    else mapa.set(fila.meta_id, [fila]);
  }
  return mapa;
}

export interface ParticipanteBasico {
  user_id: string;
  nombre: string;
  foto_url: string | null;
  fecha_ingreso: string;
  aparece_en_ranking: number;
  es_admin: number;
}

/** Participantes del reto con lo minimo de perfil que el grupo puede ver. */
export async function participantesDe(env: Env, retoId: string): Promise<ParticipanteBasico[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.user_id       AS user_id,
            u.nombre        AS nombre,
            u.foto_url      AS foto_url,
            p.fecha_ingreso AS fecha_ingreso,
            p.aparece_en_ranking AS aparece_en_ranking,
            u.es_admin      AS es_admin
       FROM participaciones p
       JOIN profiles u ON u.id = p.user_id
      WHERE p.reto_id = ?
      ORDER BY u.nombre COLLATE NOCASE`,
  )
    .bind(retoId)
    .all<ParticipanteBasico>();
  return results ?? [];
}
