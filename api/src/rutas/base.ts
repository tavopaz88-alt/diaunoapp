import { Hono } from 'hono';
import type { Contexto, Env, Perfil, Reto } from '../tipos';
import { fechaFinReto } from '../lib/fechas';

export type Variables = { perfil: Perfil; ctx: Contexto };
export type Enlaces = { Bindings: Env; Variables: Variables };

export function crearRuta() {
  return new Hono<Enlaces>();
}

/** Forma en que un perfil propio sale hacia el cliente (sin hash ni version). */
export function perfilPublico(perfil: Perfil) {
  return {
    id: perfil.id,
    email: perfil.email,
    nombre: perfil.nombre,
    foto_url: perfil.foto_url,
    es_admin: perfil.es_admin === 1,
    created_at: perfil.created_at,
  };
}

/** El reto tal como lo ve el cliente. El codigo de acceso no va aqui. */
export function datosDelReto(reto: Reto) {
  return {
    id: reto.id,
    nombre: reto.nombre,
    fecha_inicio: reto.fecha_inicio,
    fecha_fin: fechaFinReto(reto),
    duracion_dias: reto.duracion_dias,
  };
}
