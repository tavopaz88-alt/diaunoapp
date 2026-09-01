/**
 * La capa diaria y la semanal.
 *
 * Diario: la misma pregunta para todos los tipos, "cumpliste hoy". Es lo que se
 * llena en segundos y lo unico comparable entre personas.
 * Semanal: cambia segun el tipo y produce el resultado.
 */

import { crearRuta, datosDelReto } from './base';
import {
  cantidadesDe,
  detalleDiarioDe,
  diasPorMeta,
  metaPorId,
  metasDe,
  semanalesDe,
} from '../lib/consultas';
import { rachaActual, resultadoDeMeta, sumarPorSemana, ventanaDe } from '../lib/metricas';
import { eventoDeLogro, revisarLogros } from '../lib/eventos';
import { nuevoId } from '../lib/ids';
import {
  diaDelReto,
  diasEntre,
  esFecha,
  fechaFinReto,
  maxFecha,
  semanasDelReto,
  semanasRegistrables,
  sumarDias,
} from '../lib/fechas';
import {
  booleano,
  cuerpoJson,
  malaPeticion,
  noEncontrado,
  numeroOpcional,
  prohibido,
  textoOpcional,
  textoRequerido,
} from '../lib/respuestas';

const rutas = crearRuta();

/** Decision 11.2: se puede marcar hasta 2 dias atras. Sin esto la gente
 *  abandona al primer olvido. Hacia adelante nunca. */
const DIAS_RETROACTIVOS = 2;

/** Largo de la nota diaria: es un apunte, no un diario. */
const LARGO_NOTA = 300;

/** Pantalla principal: todo lo que "Hoy" necesita, en una sola llamada. */
rutas.get('/hoy', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');
  const zona = c.env.ZONA_HORARIA;

  const metas = await metasDe(c.env, reto.id, perfil.id, false);
  const porMeta = await diasPorMeta(c.env, reto.id, perfil.id);
  const detalle = await detalleDiarioDe(c.env, reto.id, perfil.id);
  const ventana = ventanaDe(reto, participacion.fecha_ingreso, zona);

  const todosLosDias = new Set<string>();
  for (const dias of porMeta.values()) for (const d of dias) todosLosDias.add(d);

  const frase = await c.env.DB.prepare(
    'SELECT texto FROM frases WHERE reto_id = ? AND fecha = ?',
  )
    .bind(reto.id, hoy)
    .first<{ texto: string }>();

  // Animos recibidos desde la ultima visita.
  const { results: animos } = await c.env.DB.prepare(
    `SELECT a.id AS id, a.created_at AS created_at, u.nombre AS de_nombre,
            u.foto_url AS de_foto, e.tipo AS evento_tipo, e.detalle AS evento_detalle
       FROM animos a
       JOIN profiles u ON u.id = a.de_user_id
       LEFT JOIN eventos e ON e.id = a.evento_id
      WHERE a.para_user_id = ? AND a.visto = 0
      ORDER BY a.created_at DESC
      LIMIT 20`,
  )
    .bind(perfil.id)
    .all();

  if ((animos?.length ?? 0) > 0) {
    await c.env.DB.prepare('UPDATE animos SET visto = 1 WHERE para_user_id = ? AND visto = 0')
      .bind(perfil.id)
      .run();
  }

  // Semanas cerradas sin registro: el aviso de la seccion 6.3.
  const semanales = await semanalesDe(c.env, metas.map((m) => m.id));
  const registrables = semanasRegistrables(reto, hoy).filter(
    (s) => s.fin >= participacion.fecha_ingreso,
  );

  const pendientes: { meta_id: string; titulo: string; semana_inicio: string; semana_fin: string }[] = [];
  for (const meta of metas) {
    if (meta.tipo === 'habito') continue; // el habito no pide nada semanal
    const suyas = semanales.get(meta.id) ?? [];
    for (const semana of registrables) {
      if (!suyas.some((r) => r.semana_inicio === semana.clave)) {
        pendientes.push({
          meta_id: meta.id,
          titulo: meta.titulo,
          semana_inicio: semana.clave,
          semana_fin: semana.fin,
        });
      }
    }
  }

  const primerDiaMarcable = maxFecha(
    sumarDias(hoy, -DIAS_RETROACTIVOS),
    maxFecha(reto.fecha_inicio, participacion.fecha_ingreso),
  );

  return c.json({
    reto: datosDelReto(reto),
    hoy,
    dia_del_reto: diaDelReto(reto, hoy),
    termino: hoy > fechaFinReto(reto),
    racha: rachaActual(todosLosDias, hoy),
    constancia: Math.round((
      [...todosLosDias].filter((d) => d >= ventana.desde && d <= ventana.hasta).length / ventana.dias
    ) * 100),
    frase: frase?.texto ?? null,
    animos: animos ?? [],
    primer_dia_marcable: primerDiaMarcable,
    metas: metas.map((meta) => ({
      id: meta.id,
      titulo: meta.titulo,
      tipo: meta.tipo,
      visibilidad: meta.visibilidad,
      unidad: meta.unidad,
      objetivo_diario: meta.objetivo_diario,
      cumplido_hoy: (porMeta.get(meta.id) ?? new Set()).has(hoy),
      dias_cumplidos: [...(porMeta.get(meta.id) ?? new Set())].sort(),
      // Detalle por fecha, para que el cliente lo muestre en el día que elija.
      detalle: Object.fromEntries(detalle.get(meta.id) ?? []),
      resultado: resultadoDeMeta(
        meta,
        semanales.get(meta.id) ?? [],
        porMeta.get(meta.id) ?? new Set(),
        ventana,
        sumarPorSemana(cantidadesDe(detalle.get(meta.id))),
      ),
    })),
    semanales_pendientes: pendientes,
  });
});

/**
 * Marca (o desmarca) un día de una meta, con detalle opcional.
 *
 * La pregunta sigue siendo la misma para todos los tipos y un toque la responde.
 * Encima de eso, y sin ser obligatorio, se puede anotar CUÁNTO se hizo (solo
 * acumulativas) y QUÉ se hizo (cualquier tipo).
 *
 * El detalle no entra en la constancia: esa se calcula solo con `cumplido`, para
 * que siga siendo comparable entre personas sin importar quién anota más.
 */
rutas.post('/dias', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const metaId = textoRequerido(datos, 'meta_id');
  const fecha = textoRequerido(datos, 'fecha');
  const cantidad = numeroOpcional(datos, 'cantidad');
  const nota = textoOpcional(datos, 'nota', LARGO_NOTA);

  // Anotar detalle implica que ese día se hizo algo: sería raro cargar 5 km y
  // que el día quedara sin marcar.
  const hayDetalle = cantidad !== null || nota !== null;
  const cumplido = hayDetalle ? true : booleano(datos, 'cumplido', true);

  if (!esFecha(fecha)) throw malaPeticion('La fecha debe ser YYYY-MM-DD');

  const meta = await metaPorId(c.env, metaId);
  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');
  if (meta.archivada === 1) throw malaPeticion('Esa meta está archivada');

  if (fecha > hoy) throw malaPeticion('Todavía no podés marcar un día que no ha pasado');
  if (diasEntre(fecha, hoy) > DIAS_RETROACTIVOS) {
    throw malaPeticion(`Solo se pueden marcar los ultimos ${DIAS_RETROACTIVOS} dias`);
  }
  if (fecha < maxFecha(reto.fecha_inicio, participacion.fecha_ingreso)) {
    throw malaPeticion('Esa fecha es anterior a tu ingreso al reto');
  }
  if (fecha > fechaFinReto(reto)) throw malaPeticion('El reto ya terminó');

  if (cantidad !== null) {
    if (meta.tipo !== 'acumulativo') {
      throw malaPeticion('Solo una meta acumulativa lleva cantidad por día');
    }
    if (cantidad < 0) throw malaPeticion('La cantidad no puede ser negativa');
  }

  if (cumplido) {
    /*
     * Un campo de detalle que no viene en la petición se deja como estaba, en
     * vez de borrarse. Así, tocar la casilla para marcar el día no le borra a
     * nadie los kilómetros que ya había anotado.
     */
    await c.env.DB.prepare(
      `INSERT INTO registros_diarios (id, meta_id, fecha, cumplido, cantidad, nota)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT (meta_id, fecha) DO UPDATE SET
         cumplido = 1,
         cantidad = COALESCE(excluded.cantidad, registros_diarios.cantidad),
         nota     = COALESCE(excluded.nota, registros_diarios.nota)`,
    )
      .bind(nuevoId(), meta.id, fecha, cantidad, nota)
      .run();
  } else {
    // Desmarcar borra la fila: "no cumplido" y "sin registro" son lo mismo.
    await c.env.DB.prepare('DELETE FROM registros_diarios WHERE meta_id = ? AND fecha = ?')
      .bind(meta.id, fecha)
      .run();
  }

  await revisarLogros(c.env, reto, perfil.id, participacion.fecha_ingreso, c.env.ZONA_HORARIA, hoy);
  return c.json({ ok: true, fecha, cumplido });
});

/** Borra solo el detalle de un día, dejando la marca de cumplido intacta. */
rutas.post('/dias/limpiar-detalle', async (c) => {
  const { perfil } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);
  const metaId = textoRequerido(datos, 'meta_id');
  const fecha = textoRequerido(datos, 'fecha');

  const meta = await metaPorId(c.env, metaId);
  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');

  await c.env.DB.prepare(
    'UPDATE registros_diarios SET cantidad = NULL, nota = NULL WHERE meta_id = ? AND fecha = ?',
  )
    .bind(meta.id, fecha)
    .run();

  return c.json({ ok: true });
});

/** Semanas que se pueden registrar y lo que ya se registro. */
rutas.get('/semanas', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');

  const metas = await metasDe(c.env, reto.id, perfil.id, false);
  const semanales = await semanalesDe(c.env, metas.map((m) => m.id));
  const detalle = await detalleDiarioDe(c.env, reto.id, perfil.id);

  return c.json({
    semanas: semanasDelReto(reto),
    registrables: semanasRegistrables(reto, hoy)
      .filter((s) => s.fin >= participacion.fecha_ingreso)
      .map((s) => s.clave),
    metas: metas
      .filter((m) => m.tipo !== 'habito')
      .map((meta) => ({
        id: meta.id,
        titulo: meta.titulo,
        tipo: meta.tipo,
        unidad: meta.unidad,
        valor_inicial: meta.valor_inicial,
        valor_objetivo: meta.valor_objetivo,
        direccion: meta.direccion,
        registros: semanales.get(meta.id) ?? [],
        /*
         * Semanas cuyo total ya sale de las cargas diarias. El formulario las
         * muestra calculadas y no vuelve a pedirlas: si no, la misma semana se
         * cargaria dos veces y los numeros no cerrarian.
         */
        desde_diario: Object.fromEntries(sumarPorSemana(cantidadesDe(detalle.get(meta.id)))),
      })),
  });
});

/** Registro semanal. Se puede llenar con retraso, nunca por adelantado. */
rutas.post('/semanas', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const metaId = textoRequerido(datos, 'meta_id');
  const semanaInicio = textoRequerido(datos, 'semana_inicio');

  const meta = await metaPorId(c.env, metaId);
  if (!meta) throw noEncontrado('Esa meta no existe');
  if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');
  if (meta.tipo === 'habito') {
    throw malaPeticion('Un hábito no lleva registro semanal: solo constancia diaria');
  }

  const semana = semanasDelReto(reto).find((s) => s.clave === semanaInicio);
  if (!semana) throw malaPeticion('Esa semana no pertenece al reto');
  if (semana.fin > hoy) throw malaPeticion('Esa semana todavía no cierra');

  let valor: number | null = null;
  let texto: string | null = null;

  if (meta.tipo === 'hito') {
    texto = textoRequerido(datos, 'texto', { max: 500 });
  } else {
    valor = numeroOpcional(datos, 'valor');
    if (valor === null) throw malaPeticion('Falta el valor de la semana');
    if (meta.tipo === 'acumulativo' && valor < 0) {
      throw malaPeticion('Una meta acumulativa no admite valores negativos');
    }
    texto = textoOpcional(datos, 'texto', 500);
  }

  const id = nuevoId();
  await c.env.DB.prepare(
    `INSERT INTO registros_semanales (id, meta_id, semana_inicio, valor, texto)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (meta_id, semana_inicio)
     DO UPDATE SET valor = excluded.valor, texto = excluded.texto, updated_at = datetime('now')`,
  )
    .bind(id, meta.id, semana.clave, valor, texto)
    .run();

  if (meta.tipo === 'hito' && texto) {
    const fila = await c.env.DB.prepare(
      'SELECT id FROM registros_semanales WHERE meta_id = ? AND semana_inicio = ?',
    )
      .bind(meta.id, semana.clave)
      .first<{ id: string }>();
    if (fila) await eventoDeLogro(c.env, meta, fila.id, texto);
  }

  await revisarLogros(c.env, reto, perfil.id, participacion.fecha_ingreso, c.env.ZONA_HORARIA, hoy);
  return c.json({ ok: true });
});

export default rutas;
