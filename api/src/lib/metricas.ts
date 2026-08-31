/**
 * Constancia, rachas y resultado por tipo de meta.
 *
 * La constancia y el resultado se calculan por separado a proposito: alguien
 * puede tener 100% de constancia y poco resultado, o al reves. Un solo numero
 * mezclaria las dos cosas y no diria nada util.
 */

import { diasEntre, hoyDentroDelReto, maxFecha, sumarDias } from './fechas';
import type { Meta, RegistroSemanal, Reto } from '../tipos';

/** Dias que le "cuentan" a alguien: desde que se unio hasta hoy, dentro del reto. */
export interface Ventana {
  desde: string;
  hasta: string;
  dias: number;
}

export function ventanaDe(reto: Reto, fechaIngreso: string, zona: string): Ventana {
  const desde = maxFecha(reto.fecha_inicio, fechaIngreso);
  const hasta = hoyDentroDelReto(reto, zona);
  // Minimo 1: el dia en que alguien entra ya cuenta como un dia con oportunidad.
  const dias = Math.max(1, diasEntre(desde, hasta) + 1);
  return { desde, hasta, dias };
}

export interface Constancia {
  dias_cumplidos: number;
  dias_transcurridos: number;
  porcentaje: number; // 0-100, redondeado
  racha: number;
}

/**
 * Constancia = dias con al menos una meta cumplida / dias transcurridos.
 * Se usa porcentaje y no conteo absoluto para que quien entra tarde no arranque
 * en desventaja permanente (seccion 5.1).
 */
export function calcularConstancia(dias: Set<string>, ventana: Ventana, hoy: string): Constancia {
  let cumplidos = 0;
  for (const dia of dias) {
    if (dia >= ventana.desde && dia <= ventana.hasta) cumplidos += 1;
  }
  return {
    dias_cumplidos: cumplidos,
    dias_transcurridos: ventana.dias,
    porcentaje: Math.round((cumplidos / ventana.dias) * 100),
    racha: rachaActual(dias, hoy),
  };
}

/**
 * Racha actual. Si hoy todavia no se marca, se cuenta desde ayer: de lo
 * contrario la racha "se rompe" cada manana hasta que la persona abre la app,
 * que es exactamente el tipo de caida que la app no debe mostrar.
 */
export function rachaActual(dias: Set<string>, hoy: string): number {
  let cursor = dias.has(hoy) ? hoy : sumarDias(hoy, -1);
  if (!dias.has(cursor)) return 0;

  let racha = 0;
  while (dias.has(cursor)) {
    racha += 1;
    cursor = sumarDias(cursor, -1);
  }
  return racha;
}

/** Racha mas larga alcanzada en todo el periodo. */
export function rachaMaxima(dias: Set<string>): number {
  const ordenadas = [...dias].sort();
  let mejor = 0;
  let actual = 0;
  let previa: string | null = null;

  for (const dia of ordenadas) {
    actual = previa !== null && diasEntre(previa, dia) === 1 ? actual + 1 : 1;
    if (actual > mejor) mejor = actual;
    previa = dia;
  }
  return mejor;
}

// ------------------------------------------------------------------ resultado

export interface ResultadoHabito {
  tipo: 'habito';
  dias_cumplidos: number;
  dias_transcurridos: number;
  porcentaje: number;
  racha_maxima: number;
}

export interface ResultadoAcumulativo {
  tipo: 'acumulativo';
  acumulado: number;
  objetivo: number;
  unidad: string;
  porcentaje: number;
  ritmo_semanal: number;
  semanas_registradas: number;
  por_semana: { semana_inicio: string; valor: number }[];
}

export interface ResultadoMedicion {
  tipo: 'medicion';
  inicial: number;
  actual: number;
  objetivo: number;
  unidad: string;
  direccion: 'subir' | 'bajar';
  cambio: number;         // actual - inicial, con signo
  porcentaje: number;     // 0-100 del camino recorrido
  trayectoria: { semana_inicio: string; valor: number }[];
}

export interface ResultadoHito {
  tipo: 'hito';
  cantidad: number;
  logros: { semana_inicio: string; texto: string }[];
}

export type Resultado =
  | ResultadoHabito
  | ResultadoAcumulativo
  | ResultadoMedicion
  | ResultadoHito;

function acotar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Metrica de resultado de una meta, segun su tipo.
 * `diasMeta` son las fechas cumplidas de ESA meta; `ventana`, los dias que le
 * corresponden a la persona.
 */
export function resultadoDeMeta(
  meta: Meta,
  semanales: RegistroSemanal[],
  diasMeta: Set<string>,
  ventana: Ventana,
): Resultado {
  const ordenados = [...semanales].sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));

  if (meta.tipo === 'habito') {
    const cumplidos = [...diasMeta].filter((d) => d >= ventana.desde && d <= ventana.hasta).length;
    return {
      tipo: 'habito',
      dias_cumplidos: cumplidos,
      dias_transcurridos: ventana.dias,
      porcentaje: Math.round((cumplidos / ventana.dias) * 100),
      racha_maxima: rachaMaxima(diasMeta),
    };
  }

  if (meta.tipo === 'acumulativo') {
    const conValor = ordenados.filter((r) => r.valor !== null);
    const acumulado = conValor.reduce((suma, r) => suma + (r.valor ?? 0), 0);
    const objetivo = meta.valor_objetivo ?? 0;
    return {
      tipo: 'acumulativo',
      acumulado,
      objetivo,
      unidad: meta.unidad ?? '',
      porcentaje: objetivo > 0 ? acotar(Math.round((acumulado / objetivo) * 100), 0, 100) : 0,
      ritmo_semanal: conValor.length ? Math.round((acumulado / conValor.length) * 10) / 10 : 0,
      semanas_registradas: conValor.length,
      por_semana: conValor.map((r) => ({ semana_inicio: r.semana_inicio, valor: r.valor as number })),
    };
  }

  if (meta.tipo === 'medicion') {
    const inicial = meta.valor_inicial ?? 0;
    const objetivo = meta.valor_objetivo ?? 0;
    const conValor = ordenados.filter((r) => r.valor !== null);
    const ultimo = conValor.at(-1);
    const actual = ultimo?.valor ?? inicial;
    const recorrido = objetivo === inicial ? 1 : (actual - inicial) / (objetivo - inicial);

    return {
      tipo: 'medicion',
      inicial,
      actual,
      objetivo,
      unidad: meta.unidad ?? '',
      direccion: meta.direccion ?? 'bajar',
      cambio: Math.round((actual - inicial) * 100) / 100,
      // Retroceder no da porcentaje negativo: se muestra 0 y ya.
      porcentaje: acotar(Math.round(recorrido * 100), 0, 100),
      trayectoria: [
        { semana_inicio: ventana.desde, valor: inicial },
        ...conValor.map((r) => ({ semana_inicio: r.semana_inicio, valor: r.valor as number })),
      ],
    };
  }

  const logros = ordenados
    .filter((r) => r.texto !== null && r.texto.trim() !== '')
    .map((r) => ({ semana_inicio: r.semana_inicio, texto: r.texto as string }));
  return { tipo: 'hito', cantidad: logros.length, logros };
}

/** true cuando la meta alcanzo su objetivo numerico. Habito e hito no lo tienen. */
export function alcanzoObjetivo(meta: Meta, resultado: Resultado): boolean {
  if (resultado.tipo === 'acumulativo') {
    return resultado.objetivo > 0 && resultado.acumulado >= resultado.objetivo;
  }
  if (resultado.tipo === 'medicion') {
    return meta.direccion === 'bajar'
      ? resultado.actual <= resultado.objetivo
      : resultado.actual >= resultado.objetivo;
  }
  return false;
}
