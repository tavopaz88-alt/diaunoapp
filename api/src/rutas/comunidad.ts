/**
 * Comunidad: impulso del grupo, top 5, tu posicion, muro de logros y animos.
 *
 * DECISION DE DISENO MAS IMPORTANTE DEL PRODUCTO (seccion 5.2):
 * no se devuelve la tabla completa ordenada. Salen los cinco primeros y la
 * posicion de quien pregunta, y nada mas. Nadie puede saber quien va ultimo,
 * porque ver el ultimo lugar es la forma mas rapida de que alguien abandone y
 * es justo la persona que mas necesita al grupo.
 *
 * Por eso el recorte se hace aqui, en el servidor: si la API devolviera la
 * lista completa "para que el cliente muestre solo 5", cualquiera podria leerla.
 */

import { crearRuta } from './base';
import {
  diasCumplidosPorUsuario,
  cantidadesDe,
  detalleDiarioDe,
  diasPorMeta,
  metasDe,
  participacionDe,
  participantesDe,
  perfilPorId,
  semanalesDe,
} from '../lib/consultas';
import { calcularConstancia, resultadoDeMeta, sumarPorSemana, ventanaDe } from '../lib/metricas';
import { proyectarMeta, veValores, nivelSobreMeta } from '../lib/visibilidad';
import { nuevoId } from '../lib/ids';
import {
  cuerpoJson,
  malaPeticion,
  noEncontrado,
  prohibido,
  textoOpcional,
  textoRequerido,
} from '../lib/respuestas';

const rutas = crearRuta();

const TOPE_VISIBLE = 5;

/**
 * En un grupo chico, publicar el top 5 delata al ultimo por descarte: con seis
 * participantes, quien no aparece es el sexto. Para que queden al menos dos
 * posiciones sin identificar hace falta TOPE_VISIBLE + 2 personas.
 *
 * Debajo de ese umbral no se publica ranking, solo el impulso del grupo y la
 * posicion propia. Es la misma regla de la seccion 5.2 llevada al caso chico.
 */
const MINIMO_PARA_RANKING = TOPE_VISIBLE + 2;

interface FilaRanking {
  user_id: string;
  nombre: string;
  foto_url: string | null;
  porcentaje: number;
  racha: number;
}

rutas.get('/', async (c) => {
  const { perfil, reto, hoy } = c.get('ctx');
  const zona = c.env.ZONA_HORARIA;

  const participantes = await participantesDe(c.env, reto.id);
  const porUsuario = await diasCumplidosPorUsuario(c.env, reto.id);

  // --- impulso del grupo (seccion 5.3) ------------------------------------
  // Cifra agregada: crea pertenencia sin comparar a nadie con nadie.
  let diasGrupo = 0;
  let marcaronHoy = 0;
  for (const p of participantes) {
    const dias = porUsuario.get(p.user_id) ?? new Set();
    diasGrupo += dias.size;
    if (dias.has(hoy)) marcaronHoy += 1;
  }

  // --- ranking -------------------------------------------------------------
  const ranking: FilaRanking[] = participantes
    .filter((p) => p.aparece_en_ranking === 1)
    .map((p) => {
      const dias = porUsuario.get(p.user_id) ?? new Set();
      const constancia = calcularConstancia(dias, ventanaDe(reto, p.fecha_ingreso, zona), hoy);
      return {
        user_id: p.user_id,
        nombre: p.nombre,
        foto_url: p.foto_url,
        porcentaje: constancia.porcentaje,
        racha: constancia.racha,
      };
    })
    // Desempate por racha actual (seccion 5.1).
    .sort((a, b) => b.porcentaje - a.porcentaje || b.racha - a.racha || a.nombre.localeCompare(b.nombre));

  const indicePropio = ranking.findIndex((f) => f.user_id === perfil.id);
  const miPosicion =
    indicePropio >= 0
      ? {
          puesto: indicePropio + 1,
          total: ranking.length,
          porcentaje: ranking[indicePropio]?.porcentaje ?? 0,
          racha: ranking[indicePropio]?.racha ?? 0,
        }
      : null; // quien se salio del ranking no tiene puesto, y esta bien

  // --- muro de logros (seccion 5.4) ---------------------------------------
  const { results: muro } = await c.env.DB.prepare(
    `SELECT e.id AS id, e.tipo AS tipo, e.detalle AS detalle, e.created_at AS created_at,
            u.id AS user_id, u.nombre AS nombre, u.foto_url AS foto_url,
            (SELECT COUNT(*) FROM animos a WHERE a.evento_id = e.id) AS animos,
            (SELECT COUNT(*) FROM animos a WHERE a.evento_id = e.id AND a.de_user_id = ?) AS le_di_animo
       FROM eventos e
       JOIN profiles u ON u.id = e.user_id
      WHERE e.reto_id = ?
      ORDER BY e.created_at DESC, e.rowid DESC
      LIMIT 60`,
  )
    .bind(perfil.id, reto.id)
    .all();

  const hayRanking = ranking.length >= MINIMO_PARA_RANKING;

  return c.json({
    impulso: {
      participantes: participantes.length,
      dias_cumplidos_grupo: diasGrupo,
      marcaron_hoy: marcaronHoy,
    },
    // Se envia solo el corte del top; el resto de la tabla no sale del servidor.
    top: hayRanking ? ranking.slice(0, TOPE_VISIBLE) : [],
    top_oculto: !hayRanking,
    minimo_para_ranking: MINIMO_PARA_RANKING,
    mi_posicion: miPosicion,
    muro: (muro ?? []).map((e) => ({
      ...e,
      animos: Number(e.animos ?? 0),
      le_di_animo: Number(e.le_di_animo ?? 0) > 0,
    })),
  });
});

/** Perfil publico de otro participante (seccion 5.6). */
rutas.get('/perfil/:userId', async (c) => {
  const { perfil, reto, hoy } = c.get('ctx');
  const zona = c.env.ZONA_HORARIA;
  const objetivoId = c.req.param('userId');

  const objetivo = await perfilPorId(c.env, objetivoId);
  if (!objetivo) throw noEncontrado('Esa persona no existe');

  const participacion = await participacionDe(c.env, reto.id, objetivoId);
  if (!participacion) throw noEncontrado('Esa persona no participa en el reto');

  const ventana = ventanaDe(reto, participacion.fecha_ingreso, zona);
  const dias = (await diasCumplidosPorUsuario(c.env, reto.id)).get(objetivoId) ?? new Set<string>();

  // La constancia siempre es visible, incluso con metas privadas (regla de oro,
  // seccion 4.2): dice que la persona cumplio, no que cumplio.
  const constancia = calcularConstancia(dias, ventana, hoy);

  const metas = await metasDe(c.env, reto.id, objetivoId);
  const visibles = metas
    .map((meta) => ({ meta, proyectada: proyectarMeta(meta, perfil.id) }))
    .filter((x) => x.proyectada !== null);

  const semanales = await semanalesDe(c.env, visibles.map((x) => x.meta.id));
  const diariosPorMeta = await diasPorMeta(c.env, reto.id, objetivoId);
  const detallePorMeta = await detalleDiarioDe(c.env, reto.id, objetivoId);

  return c.json({
    perfil: {
      id: objetivo.id,
      nombre: objetivo.nombre,
      foto_url: objetivo.foto_url,
      desde: participacion.fecha_ingreso,
      es_admin: objetivo.es_admin === 1,
      soy_yo: objetivo.id === perfil.id,
    },
    constancia,
    dias_cumplidos: [...dias].sort(),
    metas: visibles.map(({ meta, proyectada }) => {
      const diasMeta = diariosPorMeta.get(meta.id) ?? new Set<string>();
      const detalle = veValores(nivelSobreMeta(meta, perfil.id));
      return {
        ...proyectada,
        // Con nivel `titulo` se ve si cumplio cada dia, pero no los valores.
        dias_cumplidos: [...diasMeta].sort(),
        resultado: detalle
          ? resultadoDeMeta(
              meta,
              semanales.get(meta.id) ?? [],
              diasMeta,
              ventana,
              sumarPorSemana(cantidadesDe(detallePorMeta.get(meta.id))),
            )
          : null,
      };
    }),
    // Cuantas metas oculto: se dice el numero, nunca de que son.
    metas_reservadas: metas.length - visibles.length,
  });
});

/** Ánimo: una reacción de un toque, sobre un evento, una publicación o un perfil. */
rutas.post('/animos', async (c) => {
  const { perfil, reto, hoy } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const eventoId = textoOpcional(datos, 'evento_id', 64);
  const publicacionId = textoOpcional(datos, 'publicacion_id', 64);
  const paraUsuario = textoOpcional(datos, 'para_user_id', 64);

  let destino: string;
  if (eventoId) {
    const evento = await c.env.DB.prepare('SELECT user_id, reto_id FROM eventos WHERE id = ?')
      .bind(eventoId)
      .first<{ user_id: string; reto_id: string }>();
    if (!evento || evento.reto_id !== reto.id) throw noEncontrado('Ese evento no existe');
    destino = evento.user_id;
  } else if (publicacionId) {
    const publicacion = await c.env.DB.prepare(
      'SELECT user_id, reto_id FROM publicaciones WHERE id = ?',
    )
      .bind(publicacionId)
      .first<{ user_id: string; reto_id: string }>();
    if (!publicacion || publicacion.reto_id !== reto.id) {
      throw noEncontrado('Esa publicación no existe');
    }
    destino = publicacion.user_id;
  } else if (paraUsuario) {
    const participa = await participacionDe(c.env, reto.id, paraUsuario);
    if (!participa) throw noEncontrado('Esa persona no participa en el reto');
    destino = paraUsuario;
  } else {
    throw malaPeticion('Indica un evento, una publicación o una persona');
  }

  if (destino === perfil.id) throw malaPeticion('No podés darte ánimo a vos mismo');

  // Los índices únicos limitan a un ánimo por evento, uno por publicación y uno
  // por perfil por día.
  const resultado = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO animos (id, de_user_id, para_user_id, evento_id, publicacion_id, fecha)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(nuevoId(), perfil.id, destino, eventoId ?? null, publicacionId ?? null, hoy)
    .run();

  return c.json({ ok: true, nuevo: (resultado.meta.changes ?? 0) > 0 });
});

// ===========================================================================
//  PUBLICACIONES Y COMENTARIOS
//
//  El muro de logros (arriba) lo escribe la app y es cronológico. Esto lo
//  escriben las personas.
//
//  El feed se ordena por ULTIMA ACTIVIDAD, no por interacciones: una
//  publicación sube cuando recibe un comentario. Así las conversaciones vivas
//  quedan arriba sin construir un ranking de popularidad, que en un grupo chico
//  volvería visible quién recibe atención y quién no. Es la misma razón por la
//  que el ranking corta en cinco.
//
//  Moderación: cada quien borra lo suyo, y un administrador puede borrar
//  cualquier cosa. Sin eso, el texto libre no tiene remedio.
// ===========================================================================

const LARGO_PUBLICACION = 1000;
const LARGO_COMENTARIO = 500;

interface FilaPublicacion {
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
  le_di_animo: number;
}

rutas.get('/publicaciones', async (c) => {
  const { perfil, reto } = c.get('ctx');

  const { results: publicaciones } = await c.env.DB.prepare(
    `SELECT p.id AS id, p.texto AS texto, p.created_at AS created_at,
            p.actividad_en AS actividad_en, p.meta_id AS meta_id,
            u.id AS user_id, u.nombre AS nombre, u.foto_url AS foto_url,
            m.titulo AS meta_titulo,
            (SELECT COUNT(*) FROM animos a WHERE a.publicacion_id = p.id) AS animos,
            (SELECT COUNT(*) FROM animos a
              WHERE a.publicacion_id = p.id AND a.de_user_id = ?) AS le_di_animo
       FROM publicaciones p
       JOIN profiles u ON u.id = p.user_id
       LEFT JOIN metas m ON m.id = p.meta_id AND m.visibilidad <> 'privada'
      WHERE p.reto_id = ?
      ORDER BY p.actividad_en DESC
      LIMIT 50`,
  )
    .bind(perfil.id, reto.id)
    .all<FilaPublicacion>();

  const ids = (publicaciones ?? []).map((p) => p.id);
  const comentariosPorPublicacion = new Map<string, unknown[]>();

  if (ids.length > 0) {
    const marcadores = ids.map(() => '?').join(',');
    const { results: comentarios } = await c.env.DB.prepare(
      `SELECT co.id AS id, co.publicacion_id AS publicacion_id, co.texto AS texto,
              co.created_at AS created_at,
              u.id AS user_id, u.nombre AS nombre, u.foto_url AS foto_url
         FROM comentarios co
         JOIN profiles u ON u.id = co.user_id
        WHERE co.publicacion_id IN (${marcadores})
        ORDER BY co.created_at`,
    )
      .bind(...ids)
      .all<{ publicacion_id: string }>();

    for (const comentario of comentarios ?? []) {
      const lista = comentariosPorPublicacion.get(comentario.publicacion_id);
      if (lista) lista.push(comentario);
      else comentariosPorPublicacion.set(comentario.publicacion_id, [comentario]);
    }
  }

  return c.json({
    soy_admin: perfil.es_admin === 1,
    publicaciones: (publicaciones ?? []).map((p) => ({
      ...p,
      animos: Number(p.animos ?? 0),
      le_di_animo: Number(p.le_di_animo ?? 0) > 0,
      // Se puede borrar lo propio; un administrador puede borrar cualquiera.
      puedo_borrar: p.user_id === perfil.id || perfil.es_admin === 1,
      comentarios: comentariosPorPublicacion.get(p.id) ?? [],
    })),
  });
});

rutas.post('/publicaciones', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const texto = textoRequerido(datos, 'texto', { max: LARGO_PUBLICACION });
  const metaId = textoOpcional(datos, 'meta_id', 64);

  // Colgar la publicación de una meta es opcional, pero tiene que ser una meta
  // propia y no privada: el título es justo lo que su dueño decidió reservar.
  if (metaId) {
    const meta = await c.env.DB.prepare(
      'SELECT user_id, visibilidad FROM metas WHERE id = ? AND reto_id = ?',
    )
      .bind(metaId, reto.id)
      .first<{ user_id: string; visibilidad: string }>();

    if (!meta) throw noEncontrado('Esa meta no existe');
    if (meta.user_id !== perfil.id) throw prohibido('Esa meta no es tuya');
    if (meta.visibilidad === 'privada') {
      throw malaPeticion('No podés vincular una publicación a una meta privada');
    }
  }

  const id = nuevoId();
  await c.env.DB.prepare(
    'INSERT INTO publicaciones (id, reto_id, user_id, texto, meta_id) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(id, reto.id, perfil.id, texto, metaId)
    .run();

  return c.json({ ok: true, id }, 201);
});

rutas.delete('/publicaciones/:id', async (c) => {
  const { perfil, reto } = c.get('ctx');

  const publicacion = await c.env.DB.prepare(
    'SELECT user_id, reto_id FROM publicaciones WHERE id = ?',
  )
    .bind(c.req.param('id'))
    .first<{ user_id: string; reto_id: string }>();

  if (!publicacion || publicacion.reto_id !== reto.id) {
    throw noEncontrado('Esa publicación no existe');
  }
  if (publicacion.user_id !== perfil.id && perfil.es_admin !== 1) {
    throw prohibido('Solo su autor o un administrador pueden borrarla');
  }

  // Los comentarios y los ánimos se van con ella por CASCADE.
  await c.env.DB.prepare('DELETE FROM publicaciones WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

rutas.post('/publicaciones/:id/comentarios', async (c) => {
  const { perfil, reto } = c.get('ctx');
  const publicacionId = c.req.param('id');
  const datos = await cuerpoJson(c.req.raw);
  const texto = textoRequerido(datos, 'texto', { max: LARGO_COMENTARIO });

  const publicacion = await c.env.DB.prepare('SELECT reto_id FROM publicaciones WHERE id = ?')
    .bind(publicacionId)
    .first<{ reto_id: string }>();

  if (!publicacion || publicacion.reto_id !== reto.id) {
    throw noEncontrado('Esa publicación no existe');
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO comentarios (id, publicacion_id, user_id, texto) VALUES (?, ?, ?, ?)',
    ).bind(nuevoId(), publicacionId, perfil.id, texto),
    // Comentar sube la publicación en el feed: ese es el criterio de orden.
    c.env.DB.prepare("UPDATE publicaciones SET actividad_en = datetime('now') WHERE id = ?").bind(
      publicacionId,
    ),
  ]);

  return c.json({ ok: true }, 201);
});

rutas.delete('/comentarios/:id', async (c) => {
  const { perfil, reto } = c.get('ctx');

  const comentario = await c.env.DB.prepare(
    `SELECT co.user_id AS user_id, p.reto_id AS reto_id
       FROM comentarios co
       JOIN publicaciones p ON p.id = co.publicacion_id
      WHERE co.id = ?`,
  )
    .bind(c.req.param('id'))
    .first<{ user_id: string; reto_id: string }>();

  if (!comentario || comentario.reto_id !== reto.id) throw noEncontrado('Ese comentario no existe');
  if (comentario.user_id !== perfil.id && perfil.es_admin !== 1) {
    throw prohibido('Solo su autor o un administrador pueden borrarlo');
  }

  await c.env.DB.prepare('DELETE FROM comentarios WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

export default rutas;
