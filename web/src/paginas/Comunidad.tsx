/**
 * Comunidad.
 *
 * El servidor solo manda el top 5 y tu propia posicion: la tabla completa no
 * sale de la API. Aqui no hay nada que ocultar en el cliente porque no llega.
 * Nadie ve quien va ultimo.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../lib/api';
import { useCargar, Aviso, Avatar, Cargando, Etiqueta, Vacio } from '../componentes/basicos';
import { haceCuanto } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import type { Comunidad as DatosComunidad, EventoMuro } from '../tipos';

function textoDelEvento(evento: EventoMuro): string {
  switch (evento.tipo) {
    case 'racha':
      return `lleva ${evento.detalle}`;
    case 'ingreso':
      return 'se unió al reto';
    case 'meta_completada':
      return evento.detalle ?? 'completó una meta';
    case 'logro':
      return `logro esta semana: ${evento.detalle ?? ''}`;
  }
}

export function Comunidad() {
  const { datos, cargando, error, recargar } = useCargar<DatosComunidad>('/comunidad');
  const { perfil, hoy, apareceEnRanking } = useSesion();
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  async function darAnimo(eventoId: string) {
    setFallo(null);
    try {
      await api.crear('/animos', { evento_id: eventoId });
      await recargar();
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo enviar');
    }
  }

  const { impulso, top, mi_posicion: posicion, muro } = datos;

  return (
    <div className="contenido">
      <header>
        <h1>Comunidad</h1>
      </header>

      {fallo && <Aviso>{fallo}</Aviso>}

      {/* --- impulso del grupo: pertenencia sin comparacion --- */}
      <section className="tarjeta">
        <div className="fila-entre">
          <div>
            <span className="numerote">{impulso.dias_cumplidos_grupo}</span>
            <p className="mini">días cumplidos entre todos</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="numerote">{impulso.marcaron_hoy}</span>
            <p className="mini">
              marcaron hoy
              <br />
              de {impulso.participantes}
            </p>
          </div>
        </div>
      </section>

      {/* --- top 5 --- */}
      <section className="tarjeta pila">
        <h2>{datos.top_oculto ? 'Tu constancia' : 'Los cinco primeros'}</h2>

        {datos.top_oculto ? (
          // En un grupo chico el top delataria al ultimo por descarte, asi que
          // no se publica ninguno: solo tu propia posicion.
          <p className="tenue">
            El ranking aparece cuando el reto tenga al menos {datos.minimo_para_ranking}{' '}
            participantes. Con menos, publicar los primeros deja en evidencia a quien va atras.
          </p>
        ) : top.length === 0 ? (
          <p className="tenue">Todavía no hay constancia registrada.</p>
        ) : (
          top.map((fila, i) => (
            <Link
              key={fila.user_id}
              to={`/comunidad/${fila.user_id}`}
              className="fila"
              style={{ color: 'inherit' }}
            >
              <span className={i === 0 ? 'puesto puesto-1' : 'puesto'}>{i + 1}</span>
              <Avatar nombre={fila.nombre} foto={fila.foto_url} tamano={36} />
              <span className="crece">
                {fila.nombre}
                {fila.user_id === perfil?.id && <span className="tenue"> (vos)</span>}
              </span>
              <Etiqueta variante="acento">{fila.porcentaje}%</Etiqueta>
            </Link>
          ))
        )}

        <hr className="separador" />

        {/* --- tu posicion, siempre visible --- */}
        {posicion ? (
          <p>
            Vas en el <strong>puesto {posicion.puesto}</strong> de {posicion.total} con{' '}
            <strong>{posicion.porcentaje}%</strong> de constancia
            {posicion.racha > 0 && ` y ${posicion.racha} días de racha`}.
          </p>
        ) : apareceEnRanking ? (
          <p className="tenue">Todavía no tenés posicion en el ranking.</p>
        ) : (
          <p className="tenue">
            Estás participando sin aparecer en el ranking. Lo podés cambiar en tu perfil.
          </p>
        )}

        {!datos.top_oculto && (
          <p className="mini">
            Solo se muestran los cinco primeros. Las demás posiciones las ve únicamente su dueño.
          </p>
        )}
      </section>

      {/* --- muro de logros: solo eventos positivos --- */}
      <section className="tarjeta">
        <h2 style={{ marginBottom: 8 }}>Muro de logros</h2>

        {muro.length === 0 ? (
          <Vacio>Todavía no pasa nada por aquí. Marca tu día y empieza.</Vacio>
        ) : (
          muro.map((evento) => (
            <article key={evento.id} className="evento">
              <Link to={`/comunidad/${evento.user_id}`}>
                <Avatar nombre={evento.nombre} foto={evento.foto_url} tamano={40} />
              </Link>

              <div className="crece">
                <p>
                  <Link to={`/comunidad/${evento.user_id}`} style={{ fontWeight: 600, color: 'inherit' }}>
                    {evento.nombre}
                  </Link>{' '}
                  {textoDelEvento(evento)}
                </p>
                <p className="mini">{haceCuanto(evento.created_at, hoy)}</p>
              </div>

              {evento.user_id !== perfil?.id && (
                <button
                  className={evento.le_di_animo ? 'animo dado' : 'animo'}
                  onClick={() => void darAnimo(evento.id)}
                  disabled={evento.le_di_animo}
                  aria-label={`Dar ánimo a ${evento.nombre}`}
                >
                  {evento.le_di_animo ? 'Enviado' : 'Ánimo'}
                  {evento.animos > 0 && ` ${evento.animos}`}
                </button>
              )}

              {evento.user_id === perfil?.id && evento.animos > 0 && (
                <Etiqueta variante="racha">{evento.animos}</Etiqueta>
              )}
            </article>
          ))
        )}
      </section>
    </div>
  );
}
