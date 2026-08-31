/**
 * Tareas programadas (Cron Trigger del Worker).
 *
 * Correo y no push: funciona en todos los dispositivos, sin permisos ni service
 * workers. En iOS el push solo llega si el usuario instala la app en su pantalla
 * de inicio, y eso no se puede dar por hecho (seccion 9).
 */

import { correoFraseDelDia, correoResumenSemanal, enviarCorreo } from './correo';
import { diasCumplidosPorUsuario, participantesDe, retoActivo, semanalesDe, metasDe } from './consultas';
import { calcularConstancia, ventanaDe } from './metricas';
import { diaDelReto, fechaFinReto, hoyEn, semanasRegistrables } from './fechas';
import type { Env } from '../tipos';

export interface ResultadoTarea {
  tarea: string;
  enviados: number;
  omitidos: number;
  motivo?: string;
}

/** Frase del dia a todos los participantes. */
export async function enviarFraseDelDia(env: Env): Promise<ResultadoTarea> {
  const base = { tarea: 'frase-del-dia', enviados: 0, omitidos: 0 };
  const reto = await retoActivo(env);
  if (!reto) return { ...base, motivo: 'no hay reto activo' };

  const hoy = hoyEn(env.ZONA_HORARIA);
  if (hoy < reto.fecha_inicio || hoy > fechaFinReto(reto)) {
    return { ...base, motivo: 'hoy queda fuera del reto' };
  }

  const frase = await env.DB.prepare('SELECT texto FROM frases WHERE reto_id = ? AND fecha = ?')
    .bind(reto.id, hoy)
    .first<{ texto: string }>();

  // Sin frase publicada no se manda nada: el correo es la frase del
  // administrador, no un recordatorio automatico.
  if (!frase) return { ...base, motivo: 'no hay frase publicada para hoy' };

  const participantes = await participantesDe(env, reto.id);
  const porUsuario = await diasCumplidosPorUsuario(env, reto.id);

  let enviados = 0;
  let omitidos = 0;

  for (const p of participantes) {
    const correo = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?')
      .bind(p.user_id)
      .first<{ email: string }>();
    if (!correo) {
      omitidos += 1;
      continue;
    }

    const dias = porUsuario.get(p.user_id) ?? new Set();
    const constancia = calcularConstancia(dias, ventanaDe(reto, p.fecha_ingreso, env.ZONA_HORARIA), hoy);

    const ok = await enviarCorreo(env, {
      para: correo.email,
      ...correoFraseDelDia(env, {
        nombre: p.nombre,
        frase: frase.texto,
        dia: diaDelReto(reto, hoy),
        duracion: reto.duracion_dias,
        racha: constancia.racha,
      }),
    });
    ok ? (enviados += 1) : (omitidos += 1);
  }

  return { tarea: 'frase-del-dia', enviados, omitidos };
}

/** Resumen semanal: avance propio, impulso del grupo y registros pendientes. */
export async function enviarResumenSemanal(env: Env): Promise<ResultadoTarea> {
  const base = { tarea: 'resumen-semanal', enviados: 0, omitidos: 0 };
  const reto = await retoActivo(env);
  if (!reto) return { ...base, motivo: 'no hay reto activo' };

  const hoy = hoyEn(env.ZONA_HORARIA);
  if (hoy < reto.fecha_inicio || hoy > fechaFinReto(reto)) {
    return { ...base, motivo: 'hoy queda fuera del reto' };
  }

  const participantes = await participantesDe(env, reto.id);
  const porUsuario = await diasCumplidosPorUsuario(env, reto.id);

  let diasGrupo = 0;
  for (const p of participantes) diasGrupo += (porUsuario.get(p.user_id) ?? new Set()).size;

  let enviados = 0;
  let omitidos = 0;

  for (const p of participantes) {
    const fila = await env.DB.prepare('SELECT email FROM profiles WHERE id = ?')
      .bind(p.user_id)
      .first<{ email: string }>();
    if (!fila) {
      omitidos += 1;
      continue;
    }

    const dias = porUsuario.get(p.user_id) ?? new Set();
    const constancia = calcularConstancia(dias, ventanaDe(reto, p.fecha_ingreso, env.ZONA_HORARIA), hoy);

    // Cuantos registros semanales le faltan.
    const metas = (await metasDe(env, reto.id, p.user_id, false)).filter((m) => m.tipo !== 'habito');
    const semanales = await semanalesDe(env, metas.map((m) => m.id));
    const semanas = semanasRegistrables(reto, hoy).filter((s) => s.fin >= p.fecha_ingreso);

    let pendientes = 0;
    for (const meta of metas) {
      const suyas = semanales.get(meta.id) ?? [];
      for (const s of semanas) if (!suyas.some((r) => r.semana_inicio === s.clave)) pendientes += 1;
    }

    const ok = await enviarCorreo(env, {
      para: fila.email,
      ...correoResumenSemanal(env, {
        nombre: p.nombre,
        porcentaje: constancia.porcentaje,
        racha: constancia.racha,
        diasGrupo,
        pendientes,
      }),
    });
    ok ? (enviados += 1) : (omitidos += 1);
  }

  return { tarea: 'resumen-semanal', enviados, omitidos };
}

/**
 * Limpia tokens de recuperacion vencidos. Barato y evita que la tabla crezca
 * con material sensible que ya no sirve.
 */
export async function limpiarTokens(env: Env): Promise<void> {
  await env.DB.prepare('DELETE FROM tokens_recuperacion WHERE expira_en < ? OR usado = 1')
    .bind(new Date().toISOString())
    .run();
}
