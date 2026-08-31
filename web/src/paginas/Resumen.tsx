/**
 * Resumen del reto (seccion 6.8).
 * Separa constancia de resultado por meta, y se puede compartir como imagen.
 */

import { useState } from 'react';
import { useCargar, Aviso, Barra, Cargando, Etiqueta } from '../componentes/basicos';
import { Visualizacion } from '../componentes/visualizaciones';
import { compartirResumen } from '../lib/imagen';
import { fechaCorta } from '../lib/fechas';
import type { Resumen as DatosResumen } from '../tipos';

export function Resumen() {
  const { datos, cargando, error } = useCargar<DatosResumen>('/resumen');
  const [generando, setGenerando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  const g = datos.global;

  return (
    <div className="contenido">
      <header className="pila">
        <h1>{datos.termino ? 'Cómo te fue' : 'Como vas'}</h1>
        <p className="mini">
          {datos.reto.nombre} · del {fechaCorta(datos.reto.fecha_inicio)} al{' '}
          {fechaCorta(datos.reto.fecha_fin)}
        </p>
      </header>

      {fallo && <Aviso>{fallo}</Aviso>}

      {/* --- resumen global --- */}
      <section className="tarjeta pila">
        <div className="fila-entre">
          <div>
            <span className="numerote">{g.porcentaje}%</span>
            <p className="mini">
              de constancia · {g.dias_cumplidos} de {g.dias_transcurridos} días
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="numerote">{g.racha_maxima}</span>
            <p className="mini">racha más larga</p>
          </div>
        </div>

        <Barra porcentaje={g.porcentaje} />

        {g.posicion && (
          <p className="tenue">
            {datos.termino ? 'Terminaste' : 'Vas'} en el <strong>puesto {g.posicion.puesto}</strong>{' '}
            de {g.posicion.total}.
          </p>
        )}

        {g.mas_sostenida && (
          <div className="tarjeta-plana">
            <p className="mini">Tu meta más sostenida</p>
            <p>
              <strong>{g.mas_sostenida.titulo}</strong> · {g.mas_sostenida.porcentaje}%
            </p>
          </div>
        )}

        {g.mas_floja && (
          <div className="tarjeta-plana">
            <p className="mini">La que más te costo</p>
            <p>
              <strong>{g.mas_floja.titulo}</strong> · {g.mas_floja.porcentaje}%
            </p>
          </div>
        )}
      </section>

      {/*
        La imagen es el resumen propio completo, metas privadas incluidas: es
        su dueno quien decide compartirlo. Pero "privada" es una decision
        deliberada, y que aparezca sin avisar seria una sorpresa fea, asi que se
        avisa antes de generar.
      */}
      {datos.metas.some((m) => m.visibilidad === 'privada') && (
        <p className="pista">
          La imagen incluye tus metas privadas y sus valores. En la app nadie las ha visto; si
          compartis la imagen, quedan a la vista de quien la reciba.
        </p>
      )}

      <button
        className="boton boton-ancho"
        disabled={generando}
        onClick={async () => {
          setGenerando(true);
          setFallo(null);
          try {
            await compartirResumen(datos);
          } catch (e) {
            setFallo(e instanceof Error ? e.message : 'No se pudo generar la imagen');
          } finally {
            setGenerando(false);
          }
        }}
      >
        {generando ? 'Generando...' : 'Compartir como imagen'}
      </button>

      {/* --- meta por meta --- */}
      <section className="pila">
        <h2>Meta por meta</h2>

        {datos.metas.map((meta) => (
          <article key={meta.id} className="tarjeta pila">
            <div className="fila-entre">
              <h3 className="crece">{meta.titulo}</h3>
              {meta.completada_en && <Etiqueta variante="acento">completada</Etiqueta>}
            </div>

            {/* Constancia y resultado, por separado: se puede tener 100% de
                constancia y poco resultado, o al reves. */}
            <div className="tarjeta-plana">
              <p className="mini">Constancia</p>
              <p>
                {meta.constancia.dias_cumplidos} de {meta.constancia.dias_transcurridos} días ·{' '}
                {meta.constancia.porcentaje}% · mejor racha {meta.constancia.racha_maxima}
              </p>
            </div>

            <div>
              <p className="mini" style={{ marginBottom: 8 }}>Resultado</p>
              <Visualizacion resultado={meta.resultado} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
