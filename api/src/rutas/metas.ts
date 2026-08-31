/**
 * Metas: alta, edicion, archivo y detalle.
 *
 * El tipo determina que configuracion es obligatoria y que se pregunta cada
 * semana. Esa validacion vive aqui y ademas esta como CHECK en el esquema.
 */

import { crearRuta } from './base';
import { diasPorMeta, metaPorId, metasDe, semanalesDe } from '../lib/consultas';
import { resultadoDeMeta, ventanaDe } from '../lib/metricas';
import { revisarLogros } from '../lib/eventos';
import { nuevoId } from '../lib/ids';
import { semanasDelReto } from '../lib/fechas';
import {
  booleano,
  conflicto,
  cuerpoJson,
  malaPeticion,
  noEncontrado,
  numeroOpcional,
  opcionDe,
  prohibido,
  textoOpcional,
  textoRequerido,
} from '../lib/respuestas';
import type { Direccion, TipoMeta, Visibilidad } from '../tipos';

const rutas = crearRuta();

/** Seccion 6.5: el limite existe para forzar foco, no por costo tecnico. */
const MAX_METAS_ACTIVAS = 3;

const TIPOS = ['habito', 'acumulativo', 'medicion', 'hito'] as const;
const VISIBILIDADES = ['privada', 'titulo', 'completa'] as const;
const DIRECCIONES = ['subir', 'bajar'] as const;

interface Configuracion {
  unidad: string | null;
  valor_inicial: number | null;
  valor_objetivo: number | null;
  direccion: Direccion | null;
}

/** Configuracion obligatoria y coherente segun el tipo. */
function configurarPorTipo(tipo: TipoMeta, datos: Record<string, unknown>): Configuracion {
  if (tipo === 'habito' || tipo === 'hito') {
    // Estos tipos no llevan numeros: se ignora lo que venga de mas.
    return { unidad: null, valor_inicial: null, valor_objetivo: null, direccion: null };
  }

  const unidad = textoRequerido(datos, 'unidad', { max: 24 });

  if (tipo === 'acumulativo') {
    const objetivo = numeroOpcional(datos, 'valor_objetivo');
    if (objetivo === null || objetivo <= 0) {
      throw malaPeticion('Una meta acumulativa necesita un objetivo total mayor que cero');
    }
    return { unidad, valor_inicial: null, valor_objetivo: objetivo, direccion: null };
  }

  const inicial = numeroOpcional(datos, 'valor_inicial');
  const objetivo = numeroOpcional(datos, 'valor_objetivo');
  if (inicial === null || objetivo === null) {
    throw malaPeticion('Una medición necesita valor inicial y valor objetivo');
  }
  if (inicial === objetivo) {
    throw malaPeticion('El valor objetivo tiene que ser distinto del inicial');
  }

  const direccion = opcionDe<Direccion>(datos, 'direccion', DIRECCIONES);
  // La direccion tiene que decir lo mismo que los numeros, o la barra de avance
  // y el "objetivo alcanzado" salen al reves.
  if (direccion === 'bajar' && objetivo > inicial) {
    throw malaPeticion('Si la direccion es "bajar", el objetivo debe ser menor que el valor inicial');
  }
  if (direccion === 'subir' && objetivo < inicial) {
    throw malaPeticion('Si la direccion es "subir", el objetivo debe ser mayor que el valor inicial');
  }

  return { unidad, valor_inicial: inicial, valor_objetivo: objetivo, direccion };
}

/** Mis metas con su avance. */
rutas.get('/', async (c) => {
  const { perfil, reto, participacion } = c.get('ctx');
  const zona = c.env.ZONA_HORARIA;

  const metas = await metasDe(c.env, reto.id, perfil.id);
  const semanales = await semanalesDe(c.env, metas.map((m) => m.id));
  const diarios = await diasPorMeta(c.env, reto.id, perfil.id);
  const ventana = ventanaDe(reto, participacion.fecha_ingreso, zona);

  return c.json({
    limite_activas: MAX_METAS_ACTIVAS,
    metas: metas.map((meta) => ({
      ...meta,
      archivada: meta.archivada === 1,
      resultado: resultadoDeMeta(
        meta,
        semanales.get(meta.id) ?? [],
        diarios.get(meta.id) ?? new Set(),
        ventana,
      ),
    })),
  });
});

rutas.post('/', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const activas = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM metas WHERE user_id = ? AND reto_id = ? AND archivada = 0',
  )
    .bind(perfil.id, reto.id)
    .first<{ n: number }>();

  if ((activas?.n ?? 0) >= MAX_METAS_ACTIVAS) {
    throw conflicto(
      `Ya tenes ${MAX_METAS_ACTIVAS} metas activas. Archiva una antes de crear otra: el limite es para mantener el foco.`,
    );
  }

  const titulo = textoRequerido(datos, 'titulo', { max: 120 });
  const descripcion = textoOpcional(datos, 'descripcion', 1000);
  const tipo = opcionDe<TipoMeta>(datos, 'tipo', TIPOS);
  const visibilidad = opcionDe<Visibilidad>(datos, 'visibilidad', VISIBILIDADES, 'titulo');
  const config = configurarPorTipo(tipo, datos);

  const id = nuevoId();
  await c.env.DB.prepare(
    `INSERT INTO metas
       (id, user_id, reto_id, titulo, descripcion, tipo, visibilidad,
        unidad, valor_inicial, valor_objetivo, direccion, orden)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      perfil.id,
      reto.id,
      titulo,
      descripcion,
      tipo,
      visibilidad,
      config.unidad,
      config.valor_inicial,
      config.valor_objetivo,
      config.direccion,
      activas?.n ?? 0,
    )
    .run();

  return c.json({ ok: true, id }, 201);
});

/** Detalle de una meta propia: avance, cuadricula e historial semanal. */
rutas.get('/:id', async (c) => {
  const { perfil, reto, participacion } = c.get('ctx');
  const meta = await metaPorId(c.env, c.req.param('id'));

  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');

  const semanales = (await semanalesDe(c.env, [meta.id])).get(meta.id) ?? [];
  const dias = (await diasPorMeta(c.env, reto.id, perfil.id)).get(meta.id) ?? new Set<string>();
  const ventana = ventanaDe(reto, participacion.fecha_ingreso, c.env.ZONA_HORARIA);

  return c.json({
    meta: { ...meta, archivada: meta.archivada === 1 },
    resultado: resultadoDeMeta(meta, semanales, dias, ventana),
    dias_cumplidos: [...dias].sort(),
    semanales,
    semanas: semanasDelReto(reto),
  });
});

/**
 * Edicion. El tipo no se puede cambiar: define que significan los registros ya
 * guardados, y cambiarlo los volveria basura.
 */
rutas.patch('/:id', async (c) => {
  const { perfil } = c.get('ctx');
  const meta = await metaPorId(c.env, c.req.param('id'));

  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');

  const datos = await cuerpoJson(c.req.raw);
  if (typeof datos.tipo === 'string' && datos.tipo !== meta.tipo) {
    throw malaPeticion(
      'El tipo de una meta no se puede cambiar. Archívala y crea una nueva con el tipo correcto.',
    );
  }

  const titulo = datos.titulo === undefined ? meta.titulo : textoRequerido(datos, 'titulo', { max: 120 });
  const descripcion =
    datos.descripcion === undefined ? meta.descripcion : textoOpcional(datos, 'descripcion', 1000);
  const visibilidad =
    datos.visibilidad === undefined
      ? meta.visibilidad
      : opcionDe<Visibilidad>(datos, 'visibilidad', VISIBILIDADES);
  const archivada = datos.archivada === undefined ? meta.archivada === 1 : booleano(datos, 'archivada', false);

  // La configuracion solo se revalida si viene alguno de sus campos.
  const tocaConfig = ['unidad', 'valor_inicial', 'valor_objetivo', 'direccion'].some(
    (campo) => datos[campo] !== undefined,
  );
  const config = tocaConfig
    ? configurarPorTipo(meta.tipo, {
        unidad: datos.unidad ?? meta.unidad,
        valor_inicial: datos.valor_inicial ?? meta.valor_inicial,
        valor_objetivo: datos.valor_objetivo ?? meta.valor_objetivo,
        direccion: datos.direccion ?? meta.direccion,
      })
    : {
        unidad: meta.unidad,
        valor_inicial: meta.valor_inicial,
        valor_objetivo: meta.valor_objetivo,
        direccion: meta.direccion,
      };

  await c.env.DB.prepare(
    `UPDATE metas
        SET titulo = ?, descripcion = ?, visibilidad = ?, archivada = ?,
            unidad = ?, valor_inicial = ?, valor_objetivo = ?, direccion = ?
      WHERE id = ?`,
  )
    .bind(
      titulo,
      descripcion,
      visibilidad,
      archivada ? 1 : 0,
      config.unidad,
      config.valor_inicial,
      config.valor_objetivo,
      config.direccion,
      meta.id,
    )
    .run();

  // Bajar la visibilidad tiene que alcanzar a lo YA publicado. Un evento del
  // muro sigue siendo publico despues del cambio, asi que si la meta deja de
  // permitir ese dato, el evento se retira.
  if (visibilidad !== meta.visibilidad) {
    if (visibilidad === 'privada') {
      // Ni el titulo puede quedar visible.
      await c.env.DB.prepare('DELETE FROM eventos WHERE meta_id = ?').bind(meta.id).run();
    } else if (visibilidad === 'titulo') {
      // Los logros semanales llevan el texto; el "completó su meta" solo lleva titulo.
      await c.env.DB.prepare("DELETE FROM eventos WHERE meta_id = ? AND tipo = 'logro'")
        .bind(meta.id)
        .run();
    }
  }

  return c.json({ ok: true });
});

/**
 * Baja de meta. Si ya tiene historial se archiva en vez de borrarse: la
 * constancia de los dias que ya pasaron no deberia cambiar hacia atras.
 */
rutas.delete('/:id', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');
  const meta = await metaPorId(c.env, c.req.param('id'));

  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');

  const registros = await c.env.DB.prepare(
    `SELECT (SELECT COUNT(*) FROM registros_diarios  WHERE meta_id = ?) +
            (SELECT COUNT(*) FROM registros_semanales WHERE meta_id = ?) AS n`,
  )
    .bind(meta.id, meta.id)
    .first<{ n: number }>();

  if ((registros?.n ?? 0) > 0) {
    await c.env.DB.prepare('UPDATE metas SET archivada = 1 WHERE id = ?').bind(meta.id).run();
    await revisarLogros(c.env, reto, perfil.id, participacion.fecha_ingreso, c.env.ZONA_HORARIA, hoy);
    return c.json({ ok: true, accion: 'archivada' });
  }

  await c.env.DB.prepare('DELETE FROM metas WHERE id = ?').bind(meta.id).run();
  return c.json({ ok: true, accion: 'eliminada' });
});

export default rutas;
