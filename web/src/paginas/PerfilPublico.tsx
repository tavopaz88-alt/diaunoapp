/**
 * Perfil de otro participante (seccion 5.6).
 *
 * Lo que se ve aqui ya viene recortado por el servidor segun la visibilidad de
 * cada meta. La constancia siempre esta, incluso si todas las metas son
 * privadas: dice que la persona cumplio, no que cumplio.
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ErrorApi } from '../lib/api';
import { useCargar, Aviso, Avatar, Cargando, Etiqueta } from '../componentes/basicos';
import { CuadriculaSimple } from '../componentes/Cuadricula';
import { Visualizacion, NOMBRE_TIPO } from '../componentes/visualizaciones';
import { fechaCorta } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import type { PerfilPublico as Datos } from '../tipos';

export function PerfilPublico() {
  const { userId } = useParams();
  const { reto, hoy } = useSesion();
  const { datos, cargando, error } = useCargar<Datos>(`/comunidad/perfil/${userId}`);
  const [animoDado, setAnimoDado] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  const { perfil, constancia, metas } = datos;

  return (
    <div className="contenido">
      <header className="fila">
        <Avatar nombre={perfil.nombre} foto={perfil.foto_url} tamano={64} />
        <div className="crece">
          <h1>{perfil.nombre}</h1>
          <p className="mini">Participa desde el {fechaCorta(perfil.desde)}</p>
        </div>
      </header>

      {fallo && <Aviso>{fallo}</Aviso>}

      <section className="tarjeta">
        <div className="fila-entre">
          <div>
            <span className="numerote">{constancia.porcentaje}%</span>
            <p className="mini">
              constancia · {constancia.dias_cumplidos} de {constancia.dias_transcurridos} días
            </p>
          </div>
          {constancia.racha > 0 && (
            <Etiqueta variante="racha">{constancia.racha} días seguidos</Etiqueta>
          )}
        </div>
      </section>

      {!perfil.soy_yo && (
        <button
          className={animoDado ? 'boton boton-secundario boton-ancho' : 'boton boton-ancho'}
          disabled={animoDado}
          onClick={async () => {
            setFallo(null);
            try {
              await api.crear('/animos', { para_user_id: perfil.id });
              setAnimoDado(true);
            } catch (e) {
              setFallo(e instanceof ErrorApi ? e.message : 'No se pudo enviar');
            }
          }}
        >
          {animoDado ? 'Ánimo enviado' : `Mandarle ánimo a ${perfil.nombre}`}
        </button>
      )}

      {reto && (
        <section className="tarjeta pila">
          <h2>Sus días</h2>
          <CuadriculaSimple
            inicio={reto.fecha_inicio}
            fin={reto.fecha_fin}
            hoy={hoy}
            dias={datos.dias_cumplidos}
          />
        </section>
      )}

      <section className="pila">
        <h2>Sus metas</h2>

        {metas.length === 0 && datos.metas_reservadas === 0 && (
          <p className="tenue">Todavía no tiene metas.</p>
        )}

        {metas.map((meta) => (
          <article key={meta.id} className="tarjeta pila">
            <div className="fila-entre">
              <h3 className="crece">{meta.titulo}</h3>
              <Etiqueta>{NOMBRE_TIPO[meta.tipo]}</Etiqueta>
            </div>

            {meta.detalle_visible && meta.resultado ? (
              <Visualizacion resultado={meta.resultado} />
            ) : (
              <>
                {/* Visibilidad "titulo": se ve el esfuerzo, no el dato. */}
                <p className="mini">
                  Comparte el título y su cumplimiento diario, pero reserva los valores.
                </p>
                {reto && (
                  <CuadriculaSimple
                    inicio={reto.fecha_inicio}
                    fin={reto.fecha_fin}
                    hoy={hoy}
                    dias={meta.dias_cumplidos}
                  />
                )}
              </>
            )}

            {meta.completada_en && <Etiqueta variante="acento">completada</Etiqueta>}
          </article>
        ))}

        {datos.metas_reservadas > 0 && (
          <p className="mini">
            Ademas tiene {datos.metas_reservadas} meta(s) privada(s). Cuentan para su constancia,
            pero su contenido no se comparte.
          </p>
        )}
      </section>
    </div>
  );
}
