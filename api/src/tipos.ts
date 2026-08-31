/** Bindings del Worker y tipos de fila de la base. */

export interface Env {
  DB: D1Database;
  /** Opcional: sin R2 la app funciona, solo se desactivan las fotos de perfil. */
  FOTOS?: R2Bucket;
  ASSETS: Fetcher;

  // vars de wrangler.toml
  ZONA_HORARIA: string;
  APP_URL: string;
  EMAIL_FROM: string;
  EMAIL_ACTIVO: string;

  // secretos (wrangler secret put)
  JWT_SECRET: string;
  SETUP_TOKEN: string;
  RESEND_API_KEY?: string;
}

export type TipoMeta = 'habito' | 'acumulativo' | 'medicion' | 'hito';
export type Visibilidad = 'privada' | 'titulo' | 'completa';
export type Direccion = 'subir' | 'bajar';
export type TipoEvento = 'racha' | 'meta_completada' | 'logro' | 'ingreso';

export interface Perfil {
  id: string;
  email: string;
  password_hash: string;
  password_version: number;
  nombre: string;
  foto_url: string | null;
  es_admin: number;
  created_at: string;
}

export interface Reto {
  id: string;
  nombre: string;
  fecha_inicio: string;
  duracion_dias: number;
  codigo_acceso: string;
  activo: number;
  created_by: string | null;
  created_at: string;
}

export interface Participacion {
  id: string;
  reto_id: string;
  user_id: string;
  fecha_ingreso: string;
  aparece_en_ranking: number;
  created_at: string;
}

export interface Meta {
  id: string;
  user_id: string;
  reto_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoMeta;
  visibilidad: Visibilidad;
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Direccion | null;
  orden: number;
  archivada: number;
  completada_en: string | null;
  created_at: string;
}

export interface RegistroDiario {
  id: string;
  meta_id: string;
  fecha: string;
  cumplido: number;
  created_at: string;
}

export interface RegistroSemanal {
  id: string;
  meta_id: string;
  semana_inicio: string;
  valor: number | null;
  texto: string | null;
  created_at: string;
  updated_at: string;
}

export interface Evento {
  id: string;
  user_id: string;
  reto_id: string;
  tipo: TipoEvento;
  meta_id: string | null;
  detalle: string | null;
  clave: string;
  created_at: string;
}

/** Contexto que la API arma una vez por peticion autenticada. */
export interface Contexto {
  perfil: Perfil;
  reto: Reto;
  participacion: Participacion;
  hoy: string;
}
