/** Errores y utilidades de peticion/respuesta. */

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

export const malaPeticion = (m: string) => new ErrorApi(400, m);
export const noAutorizado = (m = 'Necesitas iniciar sesión') => new ErrorApi(401, m);
export const prohibido = (m = 'No tienes acceso a esto') => new ErrorApi(403, m);
export const noEncontrado = (m = 'No se encontro') => new ErrorApi(404, m);
export const conflicto = (m: string) => new ErrorApi(409, m);

export async function cuerpoJson(peticion: Request): Promise<Record<string, unknown>> {
  const tipo = peticion.headers.get('content-type') ?? '';
  if (!tipo.includes('application/json')) {
    throw malaPeticion('Se esperaba contenido JSON');
  }
  try {
    const datos = await peticion.json();
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw malaPeticion('El cuerpo debe ser un objeto');
    }
    return datos as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ErrorApi) throw error;
    throw malaPeticion('JSON invalido');
  }
}

export function textoRequerido(
  datos: Record<string, unknown>,
  campo: string,
  opciones: { max?: number; min?: number } = {},
): string {
  const valor = datos[campo];
  if (typeof valor !== 'string') throw malaPeticion(`Falta el campo "${campo}"`);
  const limpio = valor.trim();
  const min = opciones.min ?? 1;
  if (limpio.length < min) throw malaPeticion(`"${campo}" no puede quedar vacio`);
  if (opciones.max && limpio.length > opciones.max) {
    throw malaPeticion(`"${campo}" no puede pasar de ${opciones.max} caracteres`);
  }
  return limpio;
}

export function textoOpcional(
  datos: Record<string, unknown>,
  campo: string,
  max = 2000,
): string | null {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string') throw malaPeticion(`"${campo}" debe ser texto`);
  const limpio = valor.trim();
  if (!limpio) return null;
  if (limpio.length > max) throw malaPeticion(`"${campo}" no puede pasar de ${max} caracteres`);
  return limpio;
}

export function numeroOpcional(datos: Record<string, unknown>, campo: string): number | null {
  const valor = datos[campo];
  if (valor === undefined || valor === null || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) throw malaPeticion(`"${campo}" debe ser un numero`);
  return numero;
}

export function opcionDe<T extends string>(
  datos: Record<string, unknown>,
  campo: string,
  permitidas: readonly T[],
  porDefecto?: T,
): T {
  const valor = datos[campo];
  if ((valor === undefined || valor === null || valor === '') && porDefecto !== undefined) {
    return porDefecto;
  }
  if (typeof valor !== 'string' || !permitidas.includes(valor as T)) {
    throw malaPeticion(`"${campo}" debe ser uno de: ${permitidas.join(', ')}`);
  }
  return valor as T;
}

export function booleano(datos: Record<string, unknown>, campo: string, porDefecto: boolean): boolean {
  const valor = datos[campo];
  if (valor === undefined || valor === null) return porDefecto;
  if (typeof valor === 'boolean') return valor;
  if (valor === 'true' || valor === 1) return true;
  if (valor === 'false' || valor === 0) return false;
  throw malaPeticion(`"${campo}" debe ser verdadero o falso`);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function emailRequerido(datos: Record<string, unknown>, campo = 'email'): string {
  const valor = textoRequerido(datos, campo, { max: 254 }).toLowerCase();
  if (!RE_EMAIL.test(valor)) throw malaPeticion('El correo no tiene un formato válido');
  return valor;
}

/** Minimo razonable sin castigar al usuario con reglas de composicion. */
export function claveRequerida(datos: Record<string, unknown>, campo = 'password'): string {
  const valor = datos[campo];
  if (typeof valor !== 'string') throw malaPeticion('Falta la contrasena');
  if (valor.length < 8) throw malaPeticion('La contraseña necesita al menos 8 caracteres');
  if (valor.length > 200) throw malaPeticion('La contraseña es demasiado larga');
  return valor;
}
