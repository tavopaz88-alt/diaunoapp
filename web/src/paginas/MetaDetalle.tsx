import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useCargar, Aviso, Cargando, Etiqueta, useEnvio } from '../componentes/basicos';
import { CuadriculaSimple } from '../componentes/Cuadricula';
import { Visualizacion, NOMBRE_TIPO, NOMBRE_VISIBILIDAD } from '../componentes/visualizaciones';
import { fechaCorta, rangoSemana } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import type { DetalleMeta } from '../tipos';

export function MetaDetalle() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { hoy } = useSesion();
  const { datos, cargando, error } = useCargar<DetalleMeta>(`/metas/${id}`);
  const { ocupado, error: errorAccion, enviar } = useEnvio();
  const [confirmando, setConfirmando] = useState(false);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  const { meta, resultado, semanales, semanas } = datos;
  const conValor = semanas
    .map((s) => ({ semana: s, registro: semanales.find((r) => r.semana_inicio === s.clave) }))
    .filter((x) => x.registro)
    .reverse();

  return (
    <div className="contenido">
      <header className="pila">
        <div className="fila-entre">
          <h1 className="crece">{meta.titulo}</h1>
          {meta.completada_en && <Etiqueta variante="acento">completada</Etiqueta>}
        </div>
        <div className="fila" style={{ gap: 6, flexWrap: 'wrap' }}>
          <Etiqueta>{NOMBRE_TIPO[meta.tipo]}</Etiqueta>
          <Etiqueta>{NOMBRE_VISIBILIDAD[meta.visibilidad]}</Etiqueta>
          {meta.archivada && <Etiqueta>archivada</Etiqueta>}
        </div>
      </header>

      {errorAccion && <Aviso>{errorAccion}</Aviso>}

      {/* La visualizacion cambia segun el tipo: es el punto del producto. */}
      <section className="tarjeta">
        <Visualizacion resultado={resultado} />
      </section>

      <section className="tarjeta pila">
        <h2>Constancia diaria</h2>
        <CuadriculaSimple
          inicio={semanas[0]?.inicio ?? hoy}
          fin={semanas.at(-1)?.fin ?? hoy}
          hoy={hoy}
          dias={datos.dias_cumplidos}
        />
      </section>

      {meta.tipo !== 'habito' && (
        <section className="tarjeta pila">
          <div className="fila-entre">
            <h2>Historial semanal</h2>
            <Link className="mini" to="/semanal">
              Registrar
            </Link>
          </div>

          {conValor.length === 0 ? (
            <p className="tenue">Todavía no hay registros semanales.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="pila">
              {conValor.map(({ semana, registro }) => (
                <li key={semana.clave} className="tarjeta-plana">
                  <p className="mini">
                    Semana {semana.numero} · {rangoSemana(semana.inicio, semana.fin)}
                  </p>
                  {registro?.texto && <p>{registro.texto}</p>}
                  {registro?.valor !== null && registro?.valor !== undefined && (
                    <p style={{ fontWeight: 600 }}>
                      {registro.valor} {meta.unidad}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {meta.descripcion && (
        <section className="tarjeta pila">
          <h2>Descripción</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{meta.descripcion}</p>
        </section>
      )}

      <div className="pila">
        <Link className="boton boton-secundario boton-ancho" to={`/metas/${meta.id}/editar`}>
          Editar
        </Link>

        {!confirmando ? (
          <button className="boton boton-fantasma" onClick={() => setConfirmando(true)}>
            {meta.archivada ? 'Eliminar meta' : 'Archivar meta'}
          </button>
        ) : (
          <div className="tarjeta pila">
            <p className="tenue">
              Si la meta tiene historial se archiva y deja de pedirte marca diaria. Si no tiene
              nada registrado, se elimina.
            </p>
            <div className="fila">
              <button
                className="boton boton-peligro crece"
                disabled={ocupado}
                onClick={async () => {
                  const ok = await enviar(async () => {
                    await api.borrar(`/metas/${meta.id}`);
                  });
                  if (ok) navegar('/metas', { replace: true });
                }}
              >
                Confirmar
              </button>
              <button className="boton boton-secundario crece" onClick={() => setConfirmando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {meta.completada_en && (
        <p className="mini">Objetivo alcanzado el {fechaCorta(meta.completada_en)}.</p>
      )}
    </div>
  );
}
