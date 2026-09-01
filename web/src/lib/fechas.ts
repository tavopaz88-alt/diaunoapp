/**
 * Fechas del lado del cliente.
 *
 * Mismo criterio que el servidor: se opera sobre cadenas 'YYYY-MM-DD', nunca
 * sobre objetos Date locales. El "hoy" siempre lo manda la API, porque es el
 * servidor el que conoce la zona horaria del reto; el telefono de alguien de
 * viaje no debe cambiar de que dia se trata.
 */

const MS_DIA = 86_400_000;

function pad(n: number): string {
  return String(n).padStart(2, '0');
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

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aEpoch(hasta) - aEpoch(desde)) / MS_DIA);
}

export function rangoDeFechas(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "12 de marzo" */
export function fechaCorta(fecha: string): string {
  const d = new Date(aEpoch(fecha));
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

/** "12 de marzo de 2026" */
export function fechaLarga(fecha: string): string {
  const d = new Date(aEpoch(fecha));
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "lunes 12" */
export function diaYNumero(fecha: string): string {
  const d = new Date(aEpoch(fecha));
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** Inicial del dia de la semana, para las cabeceras de la cuadricula. */
export function inicialDia(fecha: string): string {
  const d = new Date(aEpoch(fecha));
  return ['D', 'L', 'M', 'M', 'J', 'V', 'S'][d.getUTCDay()] ?? '';
}

/** "hace 2 dias", "hoy", "ayer" — para el muro. */
export function haceCuanto(iso: string, hoy: string): string {
  const fecha = iso.slice(0, 10);
  const dias = diasEntre(fecha, hoy);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 30) return `hace ${Math.floor(dias / 7)} semana(s)`;
  return fechaCorta(fecha);
}

/** "del 3 al 9 de marzo" */
export function rangoSemana(inicio: string, fin: string): string {
  const a = new Date(aEpoch(inicio));
  const b = new Date(aEpoch(fin));
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `del ${a.getUTCDate()} al ${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`;
  }
  return `del ${a.getUTCDate()} de ${MESES[a.getUTCMonth()]} al ${b.getUTCDate()} de ${MESES[b.getUTCMonth()]}`;
}

/** "1 día" / "3 días". Evita los "1 día(s)" y los "1 días seguidos". */
export function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}
