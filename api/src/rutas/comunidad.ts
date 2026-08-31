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
  diasPorMeta,
  metasDe,
  participacionDe,
  participantesDe,
  perfilPorId,
  semanalesDe,
} from '../lib/consultas';
import { calcularConstancia, resultadoDeMeta, ventanaDe } from '../lib/metricas';
import { proyectarMeta, veValores, nivelSobreMeta } from '../lib/visibilidad';
import { nuevoId } from '../lib/ids';
import { cuerpoJson, malaPeticion, noEncontrado, textoOpcional } from '../lib/respuestas';

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
          ? resultadoDeMeta(meta, semanales.get(meta.id) ?? [], diasMeta, ventana)
          : null,
      };
    }),
    // Cuantas metas oculto: se dice el numero, nunca de que son.
    metas_reservadas: metas.length - visibles.length,
  });
});

/**
 * Animo: una reaccion de un toque. Sin comentarios en esta version, porque los
 * comentarios necesitan moderacion y eso es otro proyecto (seccion 5.5).
 */
rutas.post('/animos', async (c) => {
  const { perfil, reto, hoy } = c.get('ctx');
  const datos = await cuerpoJson(c.req.raw);

  const eventoId = textoOpcional(datos, 'evento_id', 64);
  const paraUsuario = textoOpcional(datos, 'para_user_id', 64);

  let destino: string;
  if (eventoId) {
    const evento = await c.env.DB.prepare('SELECT user_id, reto_id FROM eventos WHERE id = ?')
      .bind(eventoId)
      .first<{ user_id: string; reto_id: string }>();
    if (!evento || evento.reto_id !== reto.id) throw noEncontrado('Ese evento no existe');
    destino = evento.user_id;
  } else if (paraUsuario) {
    const participa = await participacionDe(c.env, reto.id, paraUsuario);
    if (!participa) throw noEncontrado('Esa persona no participa en el reto');
    destino = paraUsuario;
  } else {
    throw malaPeticion('Indica un evento o una persona');
  }

  if (destino === perfil.id) throw malaPeticion('No podés darte ánimo a vos mismo');

  // Los indices unicos limitan a un animo por evento y a uno por perfil por dia.
  const resultado = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO animos (id, de_user_id, para_user_id, evento_id, fecha)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(nuevoId(), perfil.id, destino, eventoId ?? null, hoy)
    .run();

  return c.json({ ok: true, nuevo: (resultado.meta.changes ?? 0) > 0 });
});

export default rutas;
