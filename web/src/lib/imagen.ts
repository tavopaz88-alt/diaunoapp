/**
 * Resumen del reto como imagen (seccion 6.8).
 *
 * Se dibuja en canvas a mano en vez de convertir el DOM: da control total del
 * resultado, no arrastra ninguna libreria y sale siempre igual, sin depender de
 * como haya renderizado el navegador la pantalla.
 *
 * Formato 1080x1350 (4:5): el que mejor se ve en las redes donde se comparte.
 */

import type { Resumen } from '../tipos';

const ANCHO = 1080;
const ALTO = 1350;

const FONDO = '#14161a';
const SUPERFICIE = '#1c1f25';
const TEXTO = '#eceff3';
const SUAVE = '#9aa4b2';
const ACENTO = '#35b98a';
const RACHA = '#e8a33d';

const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function fuente(tamano: number, peso = 400): string {
  return `${peso} ${tamano}px ${FUENTE}`;
}

function redondeado(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  radio: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radio, y);
  ctx.arcTo(x + ancho, y, x + ancho, y + alto, radio);
  ctx.arcTo(x + ancho, y + alto, x, y + alto, radio);
  ctx.arcTo(x, y + alto, x, y, radio);
  ctx.arcTo(x, y, x + ancho, y, radio);
  ctx.closePath();
}

/** Corta el texto con puntos suspensivos si no cabe. */
function recortar(ctx: CanvasRenderingContext2D, texto: string, maximo: number): string {
  if (ctx.measureText(texto).width <= maximo) return texto;
  let corte = texto;
  while (corte.length > 1 && ctx.measureText(`${corte}...`).width > maximo) {
    corte = corte.slice(0, -1);
  }
  return `${corte}...`;
}

function numero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

/** Una linea de resultado por meta, segun su tipo. */
function lineaResultado(meta: Resumen['metas'][number]): string {
  const r = meta.resultado;
  switch (r.tipo) {
    case 'habito':
      return `${r.dias_cumplidos} de ${r.dias_transcurridos} días · mejor racha ${r.racha_maxima}`;
    case 'acumulativo':
      return `${numero(r.acumulado)} de ${numero(r.objetivo)} ${r.unidad} · ${r.porcentaje}%`;
    case 'medicion': {
      const signo = r.cambio > 0 ? '+' : '';
      return `de ${numero(r.inicial)} a ${numero(r.actual)} ${r.unidad} (${signo}${numero(r.cambio)})`;
    }
    case 'hito':
      return `${r.cantidad} logro(s) registrado(s)`;
  }
}

export function dibujarResumen(resumen: Resumen): Promise<Blob> {
  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) return Promise.reject(new Error('El navegador no soporta canvas'));

  ctx.fillStyle = FONDO;
  ctx.fillRect(0, 0, ANCHO, ALTO);

  const MARGEN = 80;
  let y = 120;

  // --- encabezado ---------------------------------------------------------
  ctx.fillStyle = SUAVE;
  ctx.font = fuente(30, 600);
  ctx.fillText(recortar(ctx, resumen.reto.nombre.toUpperCase(), ANCHO - MARGEN * 2), MARGEN, y);

  y += 60;
  ctx.fillStyle = TEXTO;
  ctx.font = fuente(58, 700);
  ctx.fillText(recortar(ctx, resumen.persona.nombre, ANCHO - MARGEN * 2), MARGEN, y);

  // --- constancia ---------------------------------------------------------
  y += 90;
  ctx.fillStyle = ACENTO;
  ctx.font = fuente(150, 700);
  ctx.fillText(`${resumen.global.porcentaje}%`, MARGEN, y + 60);

  ctx.fillStyle = SUAVE;
  ctx.font = fuente(30, 500);
  ctx.fillText('de constancia', MARGEN, y + 110);
  ctx.fillText(
    `${resumen.global.dias_cumplidos} de ${resumen.global.dias_transcurridos} días con al menos una meta cumplida`,
    MARGEN,
    y + 155,
  );

  // --- racha maxima -------------------------------------------------------
  y += 220;
  ctx.fillStyle = RACHA;
  ctx.font = fuente(44, 700);
  ctx.fillText(`${resumen.global.racha_maxima} días seguidos`, MARGEN, y);
  ctx.fillStyle = SUAVE;
  ctx.font = fuente(28, 500);
  ctx.fillText('su racha más larga', MARGEN, y + 40);

  // --- metas --------------------------------------------------------------
  y += 100;
  const visibles = resumen.metas.slice(0, 4);
  const ALTO_FILA = 130;

  for (const meta of visibles) {
    ctx.fillStyle = SUPERFICIE;
    redondeado(ctx, MARGEN, y, ANCHO - MARGEN * 2, ALTO_FILA - 18, 24);
    ctx.fill();

    ctx.fillStyle = TEXTO;
    ctx.font = fuente(34, 650);
    ctx.fillText(recortar(ctx, meta.titulo, ANCHO - MARGEN * 2 - 80), MARGEN + 32, y + 50);

    ctx.fillStyle = SUAVE;
    ctx.font = fuente(26, 500);
    ctx.fillText(recortar(ctx, lineaResultado(meta), ANCHO - MARGEN * 2 - 80), MARGEN + 32, y + 88);

    // Barrita de constancia de la meta.
    const anchoBarra = ANCHO - MARGEN * 2 - 64;
    ctx.fillStyle = '#2a2f38';
    redondeado(ctx, MARGEN + 32, y + 100, anchoBarra, 8, 4);
    ctx.fill();

    ctx.fillStyle = ACENTO;
    redondeado(
      ctx,
      MARGEN + 32,
      y + 100,
      Math.max(8, (anchoBarra * meta.constancia.porcentaje) / 100),
      8,
      4,
    );
    ctx.fill();

    y += ALTO_FILA;
  }

  if (resumen.metas.length > visibles.length) {
    ctx.fillStyle = SUAVE;
    ctx.font = fuente(26, 500);
    ctx.fillText(`y ${resumen.metas.length - visibles.length} meta(s) mas`, MARGEN, y + 20);
  }

  // --- pie ----------------------------------------------------------------
  ctx.fillStyle = SUAVE;
  ctx.font = fuente(28, 500);
  const posicion = resumen.global.posicion
    ? `Puesto ${resumen.global.posicion.puesto} de ${resumen.global.posicion.total}`
    : `${resumen.reto.duracion_dias} días`;
  ctx.fillText(posicion, MARGEN, ALTO - 80);

  ctx.textAlign = 'right';
  ctx.fillText(`${resumen.reto.duracion_dias} días`, ANCHO - MARGEN, ALTO - 80);
  ctx.textAlign = 'left';

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob(
      (blob) => (blob ? resolver(blob) : rechazar(new Error('No se pudo generar la imagen'))),
      'image/png',
    );
  });
}

/**
 * Comparte la imagen. En el telefono abre la hoja nativa de compartir; si no
 * esta disponible, la descarga.
 */
export async function compartirResumen(resumen: Resumen): Promise<'compartido' | 'descargado'> {
  const blob = await dibujarResumen(resumen);
  const archivo = new File([blob], 'mi-reto.png', { type: 'image/png' });

  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: resumen.reto.nombre });
      return 'compartido';
    } catch (error) {
      // Cancelar la hoja de compartir no es un error que haya que mostrar.
      if (error instanceof DOMException && error.name === 'AbortError') return 'compartido';
    }
  }

  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'mi-reto.png';
  enlace.click();
  URL.revokeObjectURL(url);
  return 'descargado';
}
