/**
 * Administracion: frase del dia, participantes y el reto.
 *
 * OJO con lo que un administrador NO puede hacer:
 *  - No ve metas privadas ni valores de metas ajenas. La privacidad aplica
 *    igual para el (ver lib/visibilidad.ts).
 *  - No recibe la tabla completa de constancia. "Nadie ve quien va último"
 *    (seccion 5.2) no tiene excepcion por rol: el administrador tambien es un
 *    participante y saber quien va ultimo no le hace falta para gestionar.
 */

import { crearRuta, datosDelReto } from './base';
import { exigirAdmin } from '../lib/autenticacion';
import { participantesDe } from '../lib/consultas';
import { nuevoCodigoAcceso, nuevoId } from '../lib/ids';
import { esFecha, fechaFinReto, hoyEn } from '../lib/fechas';
import {
  booleano,
  conflicto,
  cuerpoJson,
  malaPeticion,
  noEncontrado,
  prohibido,
  textoRequerido,
} from '../lib/respuestas';

const rutas = crearRuta();

// Todo lo de aqui exige rol de administrador.
rutas.use('*', async (c, next) => {
  exigirAdmin(c.get('perfil'));
  await next();
});

// ------------------------------------------------------------------- reto

rutas.get('/reto', async (c) => {
  const { reto } = c.get('ctx');
  const cuenta = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM participaciones WHERE reto_id = ?',
  )
    .bind(reto.id)
    .first<{ n: number }>();

  return c.json({
    reto: { ...datosDelReto(reto), codigo_acceso: reto.codigo_acceso, activo: reto.activo === 1 },
    participantes: cuenta?.n ?? 0,
  });
});

rutas.patch('/reto', async (c) => {
  const { reto } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const nombre = datos.nombre === undefined ? reto.nombre : textoRequerido(datos, 'nombre', { max: 120 });
  const fechaInicio =
    datos.fecha_inicio === undefined ? reto.fecha_inicio : textoRequerido(datos, 'fecha_inicio');
  if (!esFecha(fechaInicio)) throw malaPeticion('fecha_inicio debe ser YYYY-MM-DD');

  const duracion = datos.duracion_dias === undefined ? reto.duracion_dias : Number(datos.duracion_dias);
  if (!Number.isInteger(duracion) || duracion < 7 || duracion > 365) {
    throw malaPeticion('La duración debe estar entre 7 y 365 días');
  }

  await c.env.DB.prepare('UPDATE retos SET nombre = ?, fecha_inicio = ?, duracion_dias = ? WHERE id = ?')
    .bind(nombre, fechaInicio, duracion, reto.id)
    .run();

  /*
   * Mover la fecha de inicio hacia atrás no alcanza por sí solo.
   *
   * La constancia de cada persona se mide desde su `fecha_ingreso`, no desde el
   * arranque del reto. Si el reto se configura tres días después de haber
   * empezado de verdad, todos quedan con fecha_ingreso posterior y sus días
   * anteriores no cuentan ni se pueden marcar.
   *
   * Por eso es una casilla explícita y no un efecto silencioso: solo mueve a
   * quienes ingresaron DESPUÉS del nuevo arranque, y nunca empuja a nadie hacia
   * adelante (quien entró tarde de verdad conserva su fecha).
   */
  let ingresosMovidos = 0;
  if (booleano(datos, 'alinear_ingresos', false)) {
    const resultado = await c.env.DB.prepare(
      'UPDATE participaciones SET fecha_ingreso = ? WHERE reto_id = ? AND fecha_ingreso > ?',
    )
      .bind(fechaInicio, reto.id, fechaInicio)
      .run();
    ingresosMovidos = resultado.meta.changes ?? 0;
  }

  return c.json({ ok: true, ingresos_movidos: ingresosMovidos });
});

/** Regenera el codigo de invitacion: corta el acceso a quien ya lo tenia. */
rutas.post('/reto/codigo', async (c) => {
  const { reto } = c.get('ctx');
  const codigo = nuevoCodigoAcceso();
  await c.env.DB.prepare('UPDATE retos SET codigo_acceso = ? WHERE id = ?').bind(codigo, reto.id).run();
  return c.json({ ok: true, codigo_acceso: codigo });
});

/**
 * Decision 11.4: al terminar, el reto se archiva y se abre otro. El anterior
 * queda intacto para su resumen; los participantes se pueden arrastrar para no
 * obligar a todos a registrarse de nuevo.
 */
rutas.post('/retos', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const nombre = textoRequerido(datos, 'nombre', { max: 120 });
  const fechaInicio = textoRequerido(datos, 'fecha_inicio');
  if (!esFecha(fechaInicio)) throw malaPeticion('fecha_inicio debe ser YYYY-MM-DD');

  const duracion = Number(datos.duracion_dias ?? 30);
  if (!Number.isInteger(duracion) || duracion < 7 || duracion > 365) {
    throw malaPeticion('La duración debe estar entre 7 y 365 días');
  }
  const migrar = booleano(datos, 'migrar_participantes', true);

  const nuevoRetoId = nuevoId();
  const codigo = nuevoCodigoAcceso();
  const hoy = hoyEn(c.env.ZONA_HORARIA);

  const sentencias = [
    c.env.DB.prepare('UPDATE retos SET activo = 0 WHERE id = ?').bind(reto.id),
    c.env.DB.prepare(
      'INSERT INTO retos (id, nombre, fecha_inicio, duracion_dias, codigo_acceso, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(nuevoRetoId, nombre, fechaInicio, duracion, codigo, perfil.id),
  ];

  if (migrar) {
    const anteriores = await participantesDe(c.env, reto.id);
    // El dia de ingreso al nuevo reto es su arranque, no el del reto viejo:
    // de lo contrario la constancia arrancaria con dias que nadie pudo cumplir.
    const ingreso = fechaInicio > hoy ? fechaInicio : hoy;
    for (const p of anteriores) {
      sentencias.push(
        c.env.DB.prepare(
          'INSERT INTO participaciones (id, reto_id, user_id, fecha_ingreso) VALUES (?, ?, ?, ?)',
        ).bind(nuevoId(), nuevoRetoId, p.user_id, ingreso),
      );
    }
  }

  await c.env.DB.batch(sentencias);
  return c.json({ ok: true, id: nuevoRetoId, codigo_acceso: codigo }, 201);
});

// ------------------------------------------------------------------ frases

rutas.get('/frases', async (c) => {
  const { reto, hoy } = c.get('ctx');
  const { results } = await c.env.DB.prepare(
    `SELECT f.id AS id, f.fecha AS fecha, f.texto AS texto, u.nombre AS autor
       FROM frases f
       LEFT JOIN profiles u ON u.id = f.autor_id
      WHERE f.reto_id = ?
      ORDER BY f.fecha DESC`,
  )
    .bind(reto.id)
    .all();

  return c.json({
    hoy,
    reto: datosDelReto(reto),
    frases: results ?? [],
  });
});

/** Publica o programa la frase de un dia. Una por dia; volver a enviarla la reemplaza. */
rutas.post('/frases', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const fecha = textoRequerido(datos, 'fecha');
  if (!esFecha(fecha)) throw malaPeticion('La fecha debe ser YYYY-MM-DD');

  const texto = textoRequerido(datos, 'texto', { max: 500 });
  const fin = fechaFinReto(reto);
  if (fecha < reto.fecha_inicio || fecha > fin) {
    throw malaPeticion(`La fecha debe caer entre ${reto.fecha_inicio} y ${fin}`);
  }

  await c.env.DB.prepare(
    `INSERT INTO frases (id, reto_id, fecha, texto, autor_id) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (reto_id, fecha) DO UPDATE SET texto = excluded.texto, autor_id = excluded.autor_id`,
  )
    .bind(nuevoId(), reto.id, fecha, texto, perfil.id)
    .run();

  return c.json({ ok: true });
});

rutas.delete('/frases/:id', async (c) => {
  const { reto } = c.get('ctx');
  const resultado = await c.env.DB.prepare('DELETE FROM frases WHERE id = ? AND reto_id = ?')
    .bind(c.req.param('id'), reto.id)
    .run();

  if ((resultado.meta.changes ?? 0) === 0) throw noEncontrado('Esa frase no existe');
  return c.json({ ok: true });
});

// ----------------------------------------------------------- participantes

/**
 * Lista para gestionar, no para comparar: nombre, correo, ingreso y rol.
 * A proposito NO trae constancia ni orden por avance (ver la nota de arriba).
 */
rutas.get('/participantes', async (c) => {
  const { reto } = c.get('ctx');
  const { results } = await c.env.DB.prepare(
    `SELECT u.id AS id, u.nombre AS nombre, u.email AS email, u.foto_url AS foto_url,
            u.es_admin AS es_admin, p.fecha_ingreso AS fecha_ingreso,
            p.aparece_en_ranking AS aparece_en_ranking,
            (SELECT COUNT(*) FROM metas m WHERE m.user_id = u.id AND m.reto_id = p.reto_id
               AND m.archivada = 0) AS metas_activas
       FROM participaciones p
       JOIN profiles u ON u.id = p.user_id
      WHERE p.reto_id = ?
      ORDER BY u.nombre COLLATE NOCASE`,
  )
    .bind(reto.id)
    .all();

  return c.json({
    participantes: (results ?? []).map((p) => ({
      ...p,
      es_admin: Number(p.es_admin) === 1,
      aparece_en_ranking: Number(p.aparece_en_ranking) === 1,
    })),
  });
});

rutas.patch('/participantes/:userId', async (c) => {
  const { perfil } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);
  const objetivo = c.req.param('userId');
  const esAdmin = booleano(datos, 'es_admin', false);

  if (objetivo === perfil.id && !esAdmin) {
    throw conflicto('No podés quitarte a vos mismo el rol de administrador');
  }

  const resultado = await c.env.DB.prepare('UPDATE profiles SET es_admin = ? WHERE id = ?')
    .bind(esAdmin ? 1 : 0, objetivo)
    .run();

  if ((resultado.meta.changes ?? 0) === 0) throw noEncontrado('Esa persona no existe');
  return c.json({ ok: true });
});

/** Saca a alguien del reto. No borra su cuenta: eso solo lo hace la persona. */
rutas.delete('/participantes/:userId', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const objetivo = c.req.param('userId');

  if (objetivo === perfil.id) throw prohibido('No podés sacarte a vos mismo del reto');

  const resultado = await c.env.DB.prepare(
    'DELETE FROM participaciones WHERE reto_id = ? AND user_id = ?',
  )
    .bind(reto.id, objetivo)
    .run();

  if ((resultado.meta.changes ?? 0) === 0) throw noEncontrado('Esa persona no participa en el reto');
  return c.json({ ok: true });
});

export default rutas;
