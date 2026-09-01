/**
 * Cuadricula de dias del reto, con una franja por meta (seccion 6.3).
 *
 * Se alinea a los dias de la semana para que se lea como un calendario: la
 * columna del lunes siempre es la del lunes. Los cuadros solo dicen "cumplio",
 * nunca que se cumplio, asi que sirve igual para un perfil ajeno.
 */

import { diasEntre, fechaLarga, rangoDeFechas, sumarDias } from '../lib/fechas';

export interface SerieCuadricula {
  titulo: string;
  dias: string[];
}

interface Props {
  inicio: string;
  fin: string;
  hoy: string;
  series: SerieCuadricula[];
}

const CABECERAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Por encima de esto una franja por meta ya no se distingue en el cuadrito. */
const MAX_FRANJAS = 5;

/** 0 = lunes, para que la primera columna sea lunes. */
function columnaDe(fecha: string): number {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return dia === 0 ? 6 : dia - 1;
}

export function Cuadricula({ inicio, fin, hoy, series }: Props) {
  const dias = rangoDeFechas(inicio, fin);
  const conjuntos = series.map((s) => new Set(s.dias));

  // Huecos al principio para que el dia 1 caiga bajo su dia de la semana.
  const relleno = columnaDe(inicio);

  // Con pocas metas se dibuja una franja por meta; con muchas, un relleno
  // proporcional, porque las franjas quedarian de dos pixeles.
  const porFranjas = series.length <= MAX_FRANJAS;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          marginBottom: 6,
        }}
        aria-hidden="true"
      >
        {CABECERAS.map((letra, i) => (
          <div key={i} className="mini" style={{ textAlign: 'center' }}>
            {letra}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {Array.from({ length: relleno }, (_, i) => (
          <div key={`hueco-${i}`} />
        ))}

        {dias.map((fecha) => {
          const cumplidas = conjuntos.map((c) => c.has(fecha));
          const cuantas = cumplidas.filter(Boolean).length;
          const futuro = fecha > hoy;
          const numero = diasEntre(inicio, fecha) + 1;

          const clases = ['dia'];
          if (fecha === hoy) clases.push('hoy');
          if (futuro) clases.push('futuro');

          return (
            <div
              key={fecha}
              className={clases.join(' ')}
              title={`Día ${numero} - ${fechaLarga(fecha)}${
                futuro ? '' : ` - ${cuantas} de ${series.length} cumplida(s)`
              }`}
            >
              {!futuro && series.length > 0 && (
                porFranjas ? (
                  <div className="dia-franjas">
                    {cumplidas.map((si, i) => (
                      <div key={i} className={si ? 'dia-franja si' : 'dia-franja'} />
                    ))}
                  </div>
                ) : (
                  /*
                   * Con muchas metas, una franja por meta queda en dos pixeles y
                   * no se lee. Se pasa a un relleno que sube desde abajo con la
                   * proporcion cumplida: dice lo mismo y se ve.
                   */
                  <div className="dia-franjas" style={{ justifyContent: 'flex-end' }}>
                    <div
                      className={cuantas > 0 ? 'dia-franja si' : 'dia-franja'}
                      style={{ flex: 'none', height: `${(cuantas / series.length) * 100}%` }}
                    />
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      <p className="mini" style={{ marginTop: 8 }}>
        Día 1 el {fechaLarga(inicio)} · día {diasEntre(inicio, fin) + 1} el {fechaLarga(fin)}
        {series.length > 1 &&
          (porFranjas
            ? ` · una franja por meta (${series.length})`
            : ` · relleno proporcional sobre ${series.length} metas`)}
      </p>
    </div>
  );
}

/** Version de una sola serie: dias con al menos una meta cumplida. */
export function CuadriculaSimple({
  inicio,
  fin,
  hoy,
  dias,
}: {
  inicio: string;
  fin: string;
  hoy: string;
  dias: string[];
}) {
  return <Cuadricula inicio={inicio} fin={fin} hoy={hoy} series={[{ titulo: 'Días', dias }]} />;
}

/** Los ultimos N dias, para vistas compactas. */
export function ultimosDias(hoy: string, cantidad: number): { desde: string; hasta: string } {
  return { desde: sumarDias(hoy, -(cantidad - 1)), hasta: hoy };
}
