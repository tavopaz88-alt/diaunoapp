/**
 * Publicaciones y comentarios de la comunidad.
 *
 * El feed se ordena por última actividad (lo decide el servidor): una
 * publicación sube cuando recibe un comentario. A propósito NO se ordena por
 * cantidad de ánimos — eso volvería visible quién recibe atención y quién no,
 * que es justo lo que el resto de la app evita.
 */

import { useState } from 'react';
import { api, ErrorApi } from '../lib/api';
import { Aviso, Avatar, Cargando, useCargar } from './basicos';
import { haceCuanto } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import type { FeedPublicaciones, Meta, Publicacion } from '../tipos';

const LARGO_PUBLICACION = 1000;
const LARGO_COMENTARIO = 500;

export function Publicaciones() {
  const { perfil, hoy } = useSesion();
  const feed = useCargar<FeedPublicaciones>('/comunidad/publicaciones');
  const misMetas = useCargar<{ metas: Meta[] }>('/metas');

  const [texto, setTexto] = useState('');
  const [metaId, setMetaId] = useState('');
  const [publicando, setPublicando] = useState(false);
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [fallo, setFallo] = useState<string | null>(null);

  if (feed.cargando) return <Cargando />;
  if (feed.error || !feed.datos) {
    return <Aviso>{feed.error ?? 'No se pudo cargar'}</Aviso>;
  }

  // Solo se puede vincular a metas propias que no sean privadas.
  const vinculables = (misMetas.datos?.metas ?? []).filter(
    (m) => !m.archivada && m.visibilidad !== 'privada',
  );

  async function correr(accion: () => Promise<void>) {
    setFallo(null);
    try {
      await accion();
      await feed.recargar();
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo completar');
    }
  }

  async function publicar() {
    if (!texto.trim()) return;
    setPublicando(true);
    await correr(async () => {
      await api.crear('/comunidad/publicaciones', {
        texto,
        ...(metaId ? { meta_id: metaId } : {}),
      });
      setTexto('');
      setMetaId('');
    });
    setPublicando(false);
  }

  return (
    <div className="pila">
      {fallo && <Aviso>{fallo}</Aviso>}

      {/* --- escribir --- */}
      <div className="tarjeta pila">
        <div className="campo">
          <label htmlFor="publicacion" className="sr-solo">
            Escribí algo para el grupo
          </label>
          <textarea
            id="publicacion"
            maxLength={LARGO_PUBLICACION}
            placeholder="¿Cómo vas? Contale al grupo."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        {vinculables.length > 0 && (
          <div className="campo">
            <label htmlFor="meta-vinculada">Sobre una meta (opcional)</label>
            <select
              id="meta-vinculada"
              value={metaId}
              onChange={(e) => setMetaId(e.target.value)}
            >
              <option value="">Sin meta</option>
              {vinculables.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.titulo}
                </option>
              ))}
            </select>
            <span className="pista">Tus metas privadas no aparecen acá, a propósito.</span>
          </div>
        )}

        <button className="boton" disabled={publicando || !texto.trim()} onClick={() => void publicar()}>
          {publicando ? 'Publicando...' : 'Publicar'}
        </button>
      </div>

      {/* --- feed --- */}
      {feed.datos.publicaciones.length === 0 ? (
        <p className="vacio">Todavía no hay publicaciones. Podés escribir la primera.</p>
      ) : (
        <div className="tarjeta">
          {feed.datos.publicaciones.map((p) => (
            <Tarjeta
              key={p.id}
              publicacion={p}
              hoy={hoy}
              miId={perfil?.id ?? ''}
              soyAdmin={feed.datos?.soy_admin ?? false}
              borrador={comentarios[p.id] ?? ''}
              onBorrador={(valor) => setComentarios({ ...comentarios, [p.id]: valor })}
              onAccion={correr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  publicacion: p,
  hoy,
  miId,
  soyAdmin,
  borrador,
  onBorrador,
  onAccion,
}: {
  publicacion: Publicacion;
  hoy: string;
  miId: string;
  soyAdmin: boolean;
  borrador: string;
  onBorrador: (valor: string) => void;
  onAccion: (accion: () => Promise<void>) => Promise<void>;
}) {
  const [comentando, setComentando] = useState(false);

  return (
    <article className="publicacion">
      <div className="fila" style={{ alignItems: 'flex-start' }}>
        <Avatar nombre={p.nombre} foto={p.foto_url} tamano={40} />
        <div className="crece">
          <div className="fila-entre">
            <span>
              <strong>{p.nombre}</strong>{' '}
              <span className="mini">{haceCuanto(p.created_at, hoy)}</span>
            </span>
            {p.puedo_borrar && (
              <button
                className="borrar"
                onClick={() => {
                  if (!window.confirm('¿Borrar esta publicación y sus comentarios?')) return;
                  void onAccion(() => api.borrar(`/comunidad/publicaciones/${p.id}`));
                }}
              >
                Borrar
              </button>
            )}
          </div>

          <p className="publicacion-texto">{p.texto}</p>

          {p.meta_titulo && <span className="etiqueta">sobre: {p.meta_titulo}</span>}

          <div className="fila" style={{ marginTop: 10, gap: 8 }}>
            {p.user_id !== miId && (
              <button
                className={p.le_di_animo ? 'animo dado' : 'animo'}
                disabled={p.le_di_animo}
                onClick={() => void onAccion(() => api.crear('/animos', { publicacion_id: p.id }))}
              >
                {p.le_di_animo ? 'Enviado' : 'Ánimo'}
                {p.animos > 0 && ` ${p.animos}`}
              </button>
            )}
            {p.user_id === miId && p.animos > 0 && (
              <span className="etiqueta etiqueta-racha">{p.animos} ánimo(s)</span>
            )}

            <button className="animo" onClick={() => setComentando((v) => !v)}>
              Comentar
              {p.comentarios.length > 0 && ` ${p.comentarios.length}`}
            </button>
          </div>

          {p.comentarios.length > 0 && (
            <div className="comentarios">
              {p.comentarios.map((co) => (
                <div key={co.id} className="fila" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <Avatar nombre={co.nombre} foto={co.foto_url} tamano={28} />
                  {/* El borrar va en la fila del nombre, no al lado del texto:
                      en un telefono le robaba la mitad del ancho al comentario. */}
                  <div className="crece">
                    <div className="fila-entre">
                      <span className="mini">
                        <strong>{co.nombre}</strong> · {haceCuanto(co.created_at, hoy)}
                      </span>
                      {(co.user_id === miId || soyAdmin) && (
                        <button
                          className="borrar"
                          onClick={() =>
                            void onAccion(() => api.borrar(`/comunidad/comentarios/${co.id}`))
                          }
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                    <p className="comentario-texto">{co.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {comentando && (
            <div className="pila" style={{ marginTop: 12 }}>
              <div className="campo">
                <label htmlFor={`comentario-${p.id}`} className="sr-solo">
                  Comentario
                </label>
                <textarea
                  id={`comentario-${p.id}`}
                  maxLength={LARGO_COMENTARIO}
                  placeholder="Escribí un comentario"
                  style={{ minHeight: 64 }}
                  value={borrador}
                  onChange={(e) => onBorrador(e.target.value)}
                />
              </div>
              <button
                className="boton boton-chico"
                disabled={!borrador.trim()}
                onClick={() =>
                  void onAccion(async () => {
                    await api.crear(`/comunidad/publicaciones/${p.id}/comentarios`, {
                      texto: borrador,
                    });
                    onBorrador('');
                    setComentando(false);
                  })
                }
              >
                Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
