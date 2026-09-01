/** Formas que devuelve la API. */

export type TipoMeta = 'habito' | 'acumulativo' | 'medicion' | 'hito';
export type Visibilidad = 'privada' | 'titulo' | 'completa';
export type Direccion = 'subir' | 'bajar';

export interface Perfil {
  id: string;
  email: string;
  nombre: string;
  foto_url: string | null;
  es_admin: boolean;
  created_at: string;
}

export interface Reto {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_dias: number;
}

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
  direccion: Direccion;
  cambio: number;
  porcentaje: number;
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

export interface DetalleDia {
  cumplido: boolean;
  /** Unidades hechas ese día. Solo en acumulativas. */
  cantidad: number | null;
  /** Qué se hizo ese día, en palabras del usuario. */
  nota: string | null;
}

/** Detalle indexado por fecha (YYYY-MM-DD). */
export type DetallePorFecha = Record<string, DetalleDia>;

export interface Meta {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoMeta;
  visibilidad: Visibilidad;
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Direccion | null;
  /** Solo acumulativas: cuánto se propone hacer por día. */
  objetivo_diario: number | null;
  archivada: boolean;
  completada_en: string | null;
  resultado: Resultado;
}

export interface MetaDeHoy {
  id: string;
  titulo: string;
  tipo: TipoMeta;
  visibilidad: Visibilidad;
  unidad: string | null;
  objetivo_diario: number | null;
  cumplido_hoy: boolean;
  dias_cumplidos: string[];
  detalle: DetallePorFecha;
  resultado: Resultado;
}

export interface AnimoRecibido {
  id: string;
  created_at: string;
  de_nombre: string;
  de_foto: string | null;
  evento_tipo: string | null;
  evento_detalle: string | null;
}

export interface Hoy {
  reto: Reto;
  hoy: string;
  dia_del_reto: number;
  termino: boolean;
  racha: number;
  constancia: number;
  frase: string | null;
  animos: AnimoRecibido[];
  primer_dia_marcable: string;
  metas: MetaDeHoy[];
  semanales_pendientes: {
    meta_id: string;
    titulo: string;
    semana_inicio: string;
    semana_fin: string;
  }[];
}

export interface FilaRanking {
  user_id: string;
  nombre: string;
  foto_url: string | null;
  porcentaje: number;
  racha: number;
}

export interface EventoMuro {
  id: string;
  tipo: 'racha' | 'meta_completada' | 'logro' | 'ingreso';
  detalle: string | null;
  created_at: string;
  user_id: string;
  nombre: string;
  foto_url: string | null;
  animos: number;
  le_di_animo: boolean;
}

export interface Comunidad {
  impulso: { participantes: number; dias_cumplidos_grupo: number; marcaron_hoy: number };
  top: FilaRanking[];
  /** true cuando el grupo es tan chico que publicar el top delataria al ultimo. */
  top_oculto: boolean;
  minimo_para_ranking: number;
  mi_posicion: { puesto: number; total: number; porcentaje: number; racha: number } | null;
  muro: EventoMuro[];
}

export interface MetaVisible {
  id: string;
  titulo: string;
  tipo: TipoMeta;
  visibilidad: Visibilidad;
  descripcion: string | null;
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Direccion | null;
  archivada: boolean;
  completada_en: string | null;
  detalle_visible: boolean;
  dias_cumplidos: string[];
  resultado: Resultado | null;
}

export interface PerfilPublico {
  perfil: {
    id: string;
    nombre: string;
    foto_url: string | null;
    desde: string;
    es_admin: boolean;
    soy_yo: boolean;
  };
  constancia: {
    dias_cumplidos: number;
    dias_transcurridos: number;
    porcentaje: number;
    racha: number;
  };
  dias_cumplidos: string[];
  metas: MetaVisible[];
  metas_reservadas: number;
}

export interface Semana {
  numero: number;
  inicio: string;
  fin: string;
  clave: string;
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

export interface MetaSemanal {
  id: string;
  titulo: string;
  tipo: TipoMeta;
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Direccion | null;
  registros: RegistroSemanal[];
  /** Semanas cuyo total ya sale de las cargas diarias: no se vuelven a pedir. */
  desde_diario: Record<string, number>;
}

export interface DatosSemanas {
  semanas: Semana[];
  registrables: string[];
  metas: MetaSemanal[];
}

export interface DetalleMeta {
  meta: Meta;
  resultado: Resultado;
  dias_cumplidos: string[];
  detalle: DetallePorFecha;
  semanales: RegistroSemanal[];
  semanas: Semana[];
}

export interface MetaResumen {
  id: string;
  titulo: string;
  tipo: TipoMeta;
  unidad: string | null;
  visibilidad: Visibilidad;
  archivada: boolean;
  completada_en: string | null;
  constancia: {
    dias_cumplidos: number;
    dias_transcurridos: number;
    porcentaje: number;
    racha_maxima: number;
  };
  resultado: Resultado;
}

export interface Resumen {
  reto: Reto;
  persona: { nombre: string; foto_url: string | null; desde: string };
  termino: boolean;
  global: {
    dias_cumplidos: number;
    dias_transcurridos: number;
    porcentaje: number;
    racha_actual: number;
    racha_maxima: number;
    mas_sostenida: { titulo: string; porcentaje: number } | null;
    mas_floja: { titulo: string; porcentaje: number } | null;
    posicion: { puesto: number; total: number } | null;
  };
  metas: MetaResumen[];
}

export interface Participante {
  id: string;
  nombre: string;
  email: string;
  foto_url: string | null;
  es_admin: boolean;
  fecha_ingreso: string;
  aparece_en_ranking: boolean;
  metas_activas: number;
}

export interface Frase {
  id: string;
  fecha: string;
  texto: string;
  autor: string | null;
}

export interface Comentario {
  id: string;
  publicacion_id: string;
  texto: string;
  created_at: string;
  user_id: string;
  nombre: string;
  foto_url: string | null;
}

export interface Publicacion {
  id: string;
  texto: string;
  created_at: string;
  actividad_en: string;
  user_id: string;
  nombre: string;
  foto_url: string | null;
  meta_id: string | null;
  meta_titulo: string | null;
  animos: number;
  le_di_animo: boolean;
  puedo_borrar: boolean;
  comentarios: Comentario[];
}

export interface FeedPublicaciones {
  soy_admin: boolean;
  publicaciones: Publicacion[];
}
