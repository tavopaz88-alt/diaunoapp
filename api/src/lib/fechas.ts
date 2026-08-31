/**
 * Dia logico del reto.
 *
 * Todo lo que el usuario percibe como "un dia" se guarda como TEXT 'YYYY-MM-DD'
 * calculado en la zona horaria del reto. Nunca se deriva un dia a partir de un
 * timestamp UTC: en UTC-6 eso adelanta el dia seis horas antes de la medianoche
 * real y la gente pierde marcas.
 */

const MS_DIA = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Fecha (YYYY-MM-DD) que corresponde a un instante en una zona horaria dada. */
export function fechaEnZona(instante: Date, zona: string): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);

  const buscar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${buscar('year')}-${buscar('month')}-${buscar('day')}`;
}

/** El dia de hoy en la zona del reto. */
export function hoyEn(zona: string): string {
  return fechaEnZona(new Date(), zona);
}

/** Hora local (0-23) en la zona del reto. */
export function horaEn(zona: string): number {
  const valor = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  return Number(valor) % 24; // en-US devuelve "24" a la medianoche
}

function aEpoch(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function deEpoch(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function sumarDias(fecha: string, dias: number): string {
  return deEpoch(aEpoch(fecha) + dias * MS_DIA);
}

/** Dias de `desde` a `hasta`. Negativo si `hasta` es anterior. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aEpoch(hasta) - aEpoch(desde)) / MS_DIA);
}

export function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  return deEpoch(aEpoch(valor)) === valor; // descarta 2026-02-31
}

export function minFecha(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxFecha(a: string, b: string): string {
  return a >= b ? a : b;
}

/**
 * Lunes de la semana que contiene `fecha`.
 * Decision 11.1: la semana cierra el domingo, asi que corre de lunes a domingo.
 */
export function lunesDe(fecha: string): string {
  const dia = new Date(aEpoch(fecha)).getUTCDay(); // 0 = domingo
  const retroceso = dia === 0 ? 6 : dia - 1;
  return sumarDias(fecha, -retroceso);
}

export function domingoDe(fecha: string): string {
  return sumarDias(lunesDe(fecha), 6);
}

/** Lista de fechas de `desde` a `hasta`, ambas incluidas. */
export function rangoDeFechas(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

export interface Reto {
  id: string;
  fecha_inicio: string;
  duracion_dias: number;
}

/** Ultimo dia del reto, incluido. */
export function fechaFinReto(reto: Reto): string {
  return sumarDias(reto.fecha_inicio, reto.duracion_dias - 1);
}

/** Numero de dia dentro del reto, base 1. Puede quedar fuera de rango. */
export function diaDelReto(reto: Reto, fecha: string): number {
  return diasEntre(reto.fecha_inicio, fecha) + 1;
}

/** El dia de hoy acotado al rango del reto: sirve para no dividir por dias futuros. */
export function hoyDentroDelReto(reto: Reto, zona: string): string {
  const hoy = hoyEn(zona);
  return minFecha(maxFecha(hoy, reto.fecha_inicio), fechaFinReto(reto));
}

export interface Semana {
  numero: number;
  inicio: string; // lunes (o el arranque del reto, si cae a media semana)
  fin: string;    // domingo (o el ultimo dia del reto)
  clave: string;  // lunes real: es la que va en registros_semanales.semana_inicio
}

/** Semanas del reto, recortadas al rango real del reto. */
export function semanasDelReto(reto: Reto): Semana[] {
  const fin = fechaFinReto(reto);
  const semanas: Semana[] = [];
  let cursor = reto.fecha_inicio;
  let numero = 1;

  while (cursor <= fin) {
    const clave = lunesDe(cursor);
    const cierre = minFecha(domingoDe(cursor), fin);
    semanas.push({ numero, inicio: cursor, fin: cierre, clave });
    cursor = sumarDias(cierre, 1);
    numero += 1;
  }
  return semanas;
}

/**
 * Semanas cuyo registro ya se puede llenar: las que ya cerraron, mas la actual
 * si hoy es su ultimo dia. Decision 11.2: siempre se puede llenar con retraso,
 * asi que nunca se descarta una semana pasada.
 */
export function semanasRegistrables(reto: Reto, hoy: string): Semana[] {
  return semanasDelReto(reto).filter((s) => s.fin <= hoy);
}
