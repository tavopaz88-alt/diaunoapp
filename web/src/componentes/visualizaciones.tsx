/**
 * Una visualizacion por tipo de meta (seccion 3.1).
 *
 * Es lo que diferencia esta app de un tracker comun: bajar de peso, leer un
 * libro y armar una metodologia no se miden igual, asi que no se dibujan igual.
 *
 * Las graficas son SVG a mano: son cuatro formas simples y controladas, y
 * evitan cargar una libreria de charts entera en un telefono.
 */

import { Barra, Etiqueta } from './basicos';
import { fechaCorta } from '../lib/fechas';
import type { Resultado } from '../tipos';

function numero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1);
}

/** habito: constancia y racha maxima. Solo importa cumplir o no cumplir. */
function Habito({ resultado }: { resultado: Extract<Resultado, { tipo: 'habito' }> }) {
  return (
    <div className="pila">
      <div className="fila-entre">
        <div>
          <span className="numerote">{resultado.porcentaje}%</span>
          <span className="tenue"> de constancia</span>
        </div>
        <Etiqueta variante="racha">mejor racha: {resultado.racha_maxima}</Etiqueta>
      </div>
      <Barra porcentaje={resultado.porcentaje} />
      <p className="mini">
        {resultado.dias_cumplidos} de {resultado.dias_transcurridos} días cumplidos
      </p>
    </div>
  );
}

/** acumulativo: barra hacia el objetivo y barras por semana. */
function Acumulativo({ resultado }: { resultado: Extract<Resultado, { tipo: 'acumulativo' }> }) {
  const maximo = Math.max(...resultado.por_semana.map((s) => s.valor), 1);
  const falta = Math.max(0, resultado.objetivo - resultado.acumulado);

  return (
    <div className="pila">
      <div className="fila-entre">
        <div>
          <span className="numerote">{numero(resultado.acumulado)}</span>
          <span className="tenue">
            {' '}
            de {numero(resultado.objetivo)} {resultado.unidad}
          </span>
        </div>
        <Etiqueta variante={resultado.porcentaje >= 100 ? 'acento' : undefined}>
          {resultado.porcentaje}%
        </Etiqueta>
      </div>

      <Barra porcentaje={resultado.porcentaje} />

      <p className="mini">
        {falta > 0
          ? `Faltan ${numero(falta)} ${resultado.unidad} · ritmo de ${numero(resultado.ritmo_semanal)} por semana`
          : `Objetivo alcanzado · ritmo de ${numero(resultado.ritmo_semanal)} por semana`}
      </p>

      {resultado.por_semana.length > 0 && (
        <div>
          <p className="mini" style={{ marginBottom: 8 }}>Por semana</p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90 }}>
            {resultado.por_semana.map((s) => (
              <div
                key={s.semana_inicio}
                className="crece"
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                title={`${fechaCorta(s.semana_inicio)}: ${numero(s.valor)} ${resultado.unidad}`}
              >
                <span className="mini">{numero(s.valor)}</span>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(4, (s.valor / maximo) * 60)}px`,
                    background: 'var(--acento)',
                    borderRadius: '6px 6px 2px 2px',
                  }}
                />
                <span className="mini">{fechaCorta(s.semana_inicio).split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** medicion: trayectoria del valor con la linea de objetivo. */
function Medicion({ resultado }: { resultado: Extract<Resultado, { tipo: 'medicion' }> }) {
  const puntos = resultado.trayectoria;
  const valores = [...puntos.map((p) => p.valor), resultado.objetivo, resultado.inicial];
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const margen = (maximo - minimo) * 0.15 || 1;
  const alto = maximo + margen;
  const bajo = minimo - margen;

  const ANCHO = 320;
  const ALTO = 150;
  const PAD_X = 8;
  const PAD_Y = 14;

  const x = (i: number) =>
    PAD_X + (puntos.length <= 1 ? 0 : (i / (puntos.length - 1)) * (ANCHO - PAD_X * 2));
  const y = (valor: number) =>
    PAD_Y + ((alto - valor) / (alto - bajo || 1)) * (ALTO - PAD_Y * 2);

  const trazo = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.valor)}`).join(' ');
  const yObjetivo = y(resultado.objetivo);

  const senal = resultado.cambio === 0 ? '' : resultado.cambio > 0 ? '+' : '';
  const vaBien =
    resultado.direccion === 'bajar' ? resultado.cambio < 0 : resultado.cambio > 0;

  return (
    <div className="pila">
      <div className="fila-entre">
        <div>
          <span className="numerote">{numero(resultado.actual)}</span>
          <span className="tenue"> {resultado.unidad}</span>
        </div>
        <Etiqueta variante={vaBien ? 'acento' : undefined}>
          {senal}
          {numero(resultado.cambio)} {resultado.unidad}
        </Etiqueta>
      </div>

      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        role="img"
        aria-label={`De ${numero(resultado.inicial)} a ${numero(resultado.actual)} ${resultado.unidad}, objetivo ${numero(resultado.objetivo)}`}
      >
        {/* linea de objetivo */}
        <line
          x1={PAD_X}
          y1={yObjetivo}
          x2={ANCHO - PAD_X}
          y2={yObjetivo}
          stroke="var(--racha)"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <text x={ANCHO - PAD_X} y={yObjetivo - 6} textAnchor="end" fontSize="11" fill="var(--racha)">
          objetivo {numero(resultado.objetivo)}
        </text>

        {puntos.length > 1 && (
          <path d={trazo} fill="none" stroke="var(--acento)" strokeWidth="2.5" strokeLinejoin="round" />
        )}

        {puntos.map((p, i) => (
          <circle
            key={`${p.semana_inicio}-${i}`}
            cx={x(i)}
            cy={y(p.valor)}
            r={i === puntos.length - 1 ? 5 : 3.5}
            fill="var(--acento)"
          />
        ))}

        <text x={PAD_X} y={ALTO - 1} fontSize="11" fill="var(--texto-suave)">
          inicio {numero(resultado.inicial)}
        </text>
      </svg>

      <Barra porcentaje={resultado.porcentaje} />
      <p className="mini">
        {resultado.porcentaje}% del camino recorrido · de {numero(resultado.inicial)} hacia{' '}
        {numero(resultado.objetivo)} {resultado.unidad}
      </p>
    </div>
  );
}

/** hito: linea de tiempo de logros, uno por semana. */
function Hito({ resultado }: { resultado: Extract<Resultado, { tipo: 'hito' }> }) {
  if (resultado.cantidad === 0) {
    return (
      <div className="pila">
        <span className="numerote">0</span>
        <p className="mini">
          Todavía no hay logros registrados. Cada semana se anota que lograste, en tus palabras.
        </p>
      </div>
    );
  }

  return (
    <div className="pila">
      <div>
        <span className="numerote">{resultado.cantidad}</span>
        <span className="tenue"> logro(s) registrado(s)</span>
      </div>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {resultado.logros.map((logro, i) => (
          <li key={logro.semana_inicio} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: 'var(--acento)',
                  marginTop: 6,
                  flex: 'none',
                }}
              />
              {i < resultado.logros.length - 1 && (
                <div style={{ width: 2, flex: 1, background: 'var(--borde)', minHeight: 20 }} />
              )}
            </div>
            <div style={{ paddingBottom: 16 }}>
              <p className="mini">Semana del {fechaCorta(logro.semana_inicio)}</p>
              <p>{logro.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Visualizacion({ resultado }: { resultado: Resultado }) {
  switch (resultado.tipo) {
    case 'habito':
      return <Habito resultado={resultado} />;
    case 'acumulativo':
      return <Acumulativo resultado={resultado} />;
    case 'medicion':
      return <Medicion resultado={resultado} />;
    case 'hito':
      return <Hito resultado={resultado} />;
  }
}

/** Resumen de una linea, para listas donde no cabe la grafica completa. */
export function ResumenCorto({ resultado }: { resultado: Resultado }) {
  switch (resultado.tipo) {
    case 'habito':
      return (
        <span className="mini">
          {resultado.dias_cumplidos}/{resultado.dias_transcurridos} días · {resultado.porcentaje}%
        </span>
      );
    case 'acumulativo':
      return (
        <span className="mini">
          {numero(resultado.acumulado)} de {numero(resultado.objetivo)} {resultado.unidad}
        </span>
      );
    case 'medicion':
      return (
        <span className="mini">
          {numero(resultado.actual)} {resultado.unidad} · objetivo {numero(resultado.objetivo)}
        </span>
      );
    case 'hito':
      return <span className="mini">{resultado.cantidad} logro(s)</span>;
  }
}

export const NOMBRE_TIPO: Record<string, string> = {
  habito: 'Hábito',
  acumulativo: 'Acumulativo',
  medicion: 'Medición',
  hito: 'Hito',
};

export const NOMBRE_VISIBILIDAD: Record<string, string> = {
  privada: 'Privada',
  titulo: 'Solo el título',
  completa: 'Completa',
};
