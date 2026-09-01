/**
 * Resumen del reto (seccion 6.8).
 *
 * Separa constancia de resultado por meta, porque son dos cosas distintas:
 * se puede tener 100% de constancia y poco resultado, o al reves.
 *
 * La posicion final sigue la misma regla que el ranking: cada quien ve la suya
 * y nadie mas. Aqui no se devuelve la tabla.
 */

import { crearRuta, datosDelReto } from './base';
import {
  cantidadesDe,
  detalleDiarioDe,
  diasCumplidosPorUsuario,
  diasPorMeta,
  metasDe,
  participantesDe,
  semanalesDe,
} from '../lib/consultas';
import {
  calcularConstancia,
  rachaMaxima,
  resultadoDeMeta,
  sumarPorSemana,
  ventanaDe,
} from '../lib/metricas';
import { fechaFinReto } from '../lib/fechas';

const rutas = crearRuta();

rutas.get('/', async (c) => {
  const { perfil, reto, participacion, hoy } = c.get('ctx');
  const zona = c.env.ZONA_HORARIA;
  const ventana = ventanaDe(reto, participacion.fecha_ingreso, zona);

  const metas = await metasDe(c.env, reto.id, perfil.id);
  const semanales = await semanalesDe(c.env, metas.map((m) => m.id));
  const porMeta = await diasPorMeta(c.env, reto.id, perfil.id);
  const detalleDiario = await detalleDiarioDe(c.env, reto.id, perfil.id);

  const todos = new Set<string>();
  for (const dias of porMeta.values()) for (const d of dias) todos.add(d);
  const constancia = calcularConstancia(todos, ventana, hoy);

  const detalle = metas.map((meta) => {
    const dias = porMeta.get(meta.id) ?? new Set<string>();
    const cumplidos = [...dias].filter((d) => d >= ventana.desde && d <= ventana.hasta).length;
    return {
      id: meta.id,
      titulo: meta.titulo,
      tipo: meta.tipo,
      unidad: meta.unidad,
      visibilidad: meta.visibilidad,
      archivada: meta.archivada === 1,
      completada_en: meta.completada_en,
      constancia: {
        dias_cumplidos: cumplidos,
        dias_transcurridos: ventana.dias,
        porcentaje: Math.round((cumplidos / ventana.dias) * 100),
        racha_maxima: rachaMaxima(dias),
      },
      resultado: resultadoDeMeta(
        meta,
        semanales.get(meta.id) ?? [],
        dias,
        ventana,
        sumarPorSemana(cantidadesDe(detalleDiario.get(meta.id))),
      ),
    };
  });

  // Mas sostenida y mas floja. Solo sale en el resumen propio: comparar las
  // metas de uno mismo es util, ver las de otros con esa etiqueta no lo seria.
  const ordenadas = [...detalle].sort(
    (a, b) => b.constancia.porcentaje - a.constancia.porcentaje,
  );

  // --- posicion final ------------------------------------------------------
  let posicion: { puesto: number; total: number } | null = null;
  if (participacion.aparece_en_ranking === 1) {
    const participantes = await participantesDe(c.env, reto.id);
    const porUsuario = await diasCumplidosPorUsuario(c.env, reto.id);

    const tabla = participantes
      .filter((p) => p.aparece_en_ranking === 1)
      .map((p) => {
        const suyos = porUsuario.get(p.user_id) ?? new Set();
        const suya = calcularConstancia(suyos, ventanaDe(reto, p.fecha_ingreso, zona), hoy);
        return { user_id: p.user_id, porcentaje: suya.porcentaje, racha: suya.racha };
      })
      .sort((a, b) => b.porcentaje - a.porcentaje || b.racha - a.racha);

    const indice = tabla.findIndex((f) => f.user_id === perfil.id);
    if (indice >= 0) posicion = { puesto: indice + 1, total: tabla.length };
  }

  return c.json({
    reto: datosDelReto(reto),
    persona: { nombre: perfil.nombre, foto_url: perfil.foto_url, desde: participacion.fecha_ingreso },
    termino: hoy > fechaFinReto(reto),
    global: {
      dias_cumplidos: constancia.dias_cumplidos,
      dias_transcurridos: constancia.dias_transcurridos,
      porcentaje: constancia.porcentaje,
      racha_actual: constancia.racha,
      racha_maxima: rachaMaxima(todos),
      mas_sostenida: ordenadas[0] ? { titulo: ordenadas[0].titulo, porcentaje: ordenadas[0].constancia.porcentaje } : null,
      mas_floja:
        ordenadas.length > 1
          ? {
              titulo: ordenadas[ordenadas.length - 1]?.titulo ?? '',
              porcentaje: ordenadas[ordenadas.length - 1]?.constancia.porcentaje ?? 0,
            }
          : null,
      posicion,
    },
    metas: detalle,
  });
});

export default rutas;
