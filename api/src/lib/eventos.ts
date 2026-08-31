/**
 * Muro de logros.
 *
 * DOS REGLAS QUE NO SE TOCAN:
 *
 * 1. Solo se generan eventos positivos. No existe "fulano perdio su racha" ni
 *    "fulano lleva 3 días sin marcar", y no debe agregarse. La app no expone
 *    caidas (secciones 5.4 y 12).
 *
 * 2. Un evento es publico para todo el grupo, asi que nunca puede contener
 *    informacion que la visibilidad de la meta reserva. Una meta `privada` no
 *    genera eventos con su titulo, y los logros semanales solo se publican si
 *    la meta es `completa`.
 */

import { nuevoId } from './ids';
import { alcanzoObjetivo, resultadoDeMeta, rachaActual, ventanaDe } from './metricas';
import {
  diasCumplidosPorUsuario,
  diasPorMeta,
  metasDe,
  semanalesDe,
} from './consultas';
import type { Env, Meta, Reto } from '../tipos';

/** Rachas que se celebran. */
const HITOS_DE_RACHA = [7, 14, 21, 30];

/** Alta idempotente: la clave unica evita publicar dos veces el mismo hito. */
async function publicar(
  env: Env,
  evento: {
    user_id: string;
    reto_id: string;
    tipo: 'racha' | 'meta_completada' | 'logro' | 'ingreso';
    meta_id?: string | null;
    detalle: string;
    clave: string;
  },
): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO eventos (id, user_id, reto_id, tipo, meta_id, detalle, clave)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      nuevoId(),
      evento.user_id,
      evento.reto_id,
      evento.tipo,
      evento.meta_id ?? null,
      evento.detalle,
      evento.clave,
    )
    .run();
}

export async function eventoDeIngreso(env: Env, retoId: string, userId: string): Promise<void> {
  await publicar(env, {
    user_id: userId,
    reto_id: retoId,
    tipo: 'ingreso',
    detalle: 'se unió al reto',
    clave: `ingreso:${retoId}:${userId}`,
  });
}

/** Un logro semanal se publica solo si la meta es de visibilidad `completa`. */
export async function eventoDeLogro(
  env: Env,
  meta: Meta,
  registroSemanalId: string,
  texto: string,
): Promise<void> {
  if (meta.visibilidad !== 'completa') return;

  await publicar(env, {
    user_id: meta.user_id,
    reto_id: meta.reto_id,
    tipo: 'logro',
    meta_id: meta.id,
    detalle: `${meta.titulo}: ${texto}`,
    clave: `logro:${registroSemanalId}`,
  });
}

/**
 * Recalcula rachas y metas completadas de una persona y publica lo que
 * corresponda. Se llama despues de marcar un dia o registrar una semana.
 */
export async function revisarLogros(
  env: Env,
  reto: Reto,
  userId: string,
  fechaIngreso: string,
  zona: string,
  hoy: string,
): Promise<void> {
  const ventana = ventanaDe(reto, fechaIngreso, zona);

  // --- rachas -------------------------------------------------------------
  const porUsuario = await diasCumplidosPorUsuario(env, reto.id);
  const racha = rachaActual(porUsuario.get(userId) ?? new Set(), hoy);

  for (const hito of HITOS_DE_RACHA) {
    if (racha >= hito) {
      await publicar(env, {
        user_id: userId,
        reto_id: reto.id,
        tipo: 'racha',
        detalle: `${hito} días seguidos`,
        clave: `racha:${reto.id}:${userId}:${hito}`,
      });
    }
  }

  // --- metas completadas --------------------------------------------------
  const metas = await metasDe(env, reto.id, userId);
  const pendientes = metas.filter((m) => !m.completada_en && m.archivada === 0);
  if (pendientes.length === 0) return;

  const semanales = await semanalesDe(env, pendientes.map((m) => m.id));
  const diarios = await diasPorMeta(env, reto.id, userId);

  for (const meta of pendientes) {
    const resultado = resultadoDeMeta(
      meta,
      semanales.get(meta.id) ?? [],
      diarios.get(meta.id) ?? new Set(),
      ventana,
    );
    if (!alcanzoObjetivo(meta, resultado)) continue;

    await env.DB.prepare('UPDATE metas SET completada_en = ? WHERE id = ? AND completada_en IS NULL')
      .bind(hoy, meta.id)
      .run();

    // Una meta privada se marca como completada, pero no se anuncia:
    // el titulo es justamente lo que su dueno decidio no mostrar.
    if (meta.visibilidad === 'privada') continue;

    await publicar(env, {
      user_id: userId,
      reto_id: reto.id,
      tipo: 'meta_completada',
      meta_id: meta.id,
      detalle: `completo su meta "${meta.titulo}"`,
      clave: `meta_completada:${meta.id}`,
    });
  }
}
