/**
 * REGLAS DE ACCESO A DATOS DE OTRAS PERSONAS.
 *
 * En Supabase esto viviria en politicas RLS. D1 no tiene RLS, asi que vive aqui
 * y ESTE es el unico lugar donde se decide que ve una persona de otra. Ninguna
 * ruta debe replicar la logica: si necesita decidir, llama aqui.
 *
 * El navegador nunca habla con la base, solo con la API, asi que ocultar en el
 * frontend no es parte del modelo de seguridad.
 *
 * Regla que no se negocia: un administrador NO ve mas que cualquier otro
 * participante. Un peso corporal o un logro de trabajo son privados frente a
 * todos. Si el admin pudiera verlos, la gente registraria datos falsos y el
 * producto se vacia (seccion 4 del spec).
 */

import type { Meta, RegistroSemanal, Visibilidad } from '../tipos';

export type NivelAcceso = 'dueno' | 'completa' | 'titulo' | 'ninguno';

export function nivelSobreMeta(
  meta: Pick<Meta, 'user_id' | 'visibilidad'>,
  solicitanteId: string,
): NivelAcceso {
  if (meta.user_id === solicitanteId) return 'dueno';
  if (meta.visibilidad === 'privada') return 'ninguno';
  if (meta.visibilidad === 'completa') return 'completa';
  return 'titulo';
}

/** El titulo y el cumplimiento diario son visibles. */
export function veTitulo(nivel: NivelAcceso): boolean {
  return nivel !== 'ninguno';
}

/** Los valores y textos semanales son visibles. */
export function veValores(nivel: NivelAcceso): boolean {
  return nivel === 'dueno' || nivel === 'completa';
}

/** Forma en que una meta ajena sale hacia el cliente. */
export interface MetaVisible {
  id: string;
  titulo: string;
  tipo: Meta['tipo'];
  visibilidad: Visibilidad;
  descripcion: string | null;
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Meta['direccion'];
  archivada: boolean;
  completada_en: string | null;
  /** true cuando el que pregunta puede ver valores y logros semanales. */
  detalle_visible: boolean;
}

/**
 * Recorta una meta al nivel de quien pregunta. Devuelve null si no debe ni
 * saber que existe.
 *
 * Ojo: con nivel `titulo` tampoco salen la configuracion (objetivo, valor
 * inicial) ni la descripcion. "Bajar de 95 a 85 cm de cintura" en el objetivo
 * revela exactamente el dato que la persona quiso reservarse.
 */
export function proyectarMeta(meta: Meta, solicitanteId: string): MetaVisible | null {
  const nivel = nivelSobreMeta(meta, solicitanteId);
  if (!veTitulo(nivel)) return null;

  const detalle = veValores(nivel);
  return {
    id: meta.id,
    titulo: meta.titulo,
    tipo: meta.tipo,
    visibilidad: meta.visibilidad,
    descripcion: detalle ? meta.descripcion : null,
    unidad: detalle ? meta.unidad : null,
    valor_inicial: detalle ? meta.valor_inicial : null,
    valor_objetivo: detalle ? meta.valor_objetivo : null,
    direccion: detalle ? meta.direccion : null,
    archivada: meta.archivada === 1,
    completada_en: meta.completada_en,
    detalle_visible: detalle,
  };
}

/** Los registros semanales solo salen si el nivel llega a `completa`. */
export function filtrarSemanales(
  meta: Meta,
  semanales: RegistroSemanal[],
  solicitanteId: string,
): RegistroSemanal[] {
  return veValores(nivelSobreMeta(meta, solicitanteId)) ? semanales : [];
}
