/**
 * Pantalla principal.
 *
 * Criterio de la seccion 6.3: marcar el dia tiene que tomar menos de diez
 * segundos, y todo lo demas es secundario. Por eso las casillas van arriba,
 * antes de la frase y de la cuadricula, y el toque es optimista: la casilla
 * cambia al instante y la peticion viaja despues. Si falla, se revierte.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../lib/api';
import { useCargar, Aviso, Avatar, Cargando, Etiqueta, Palomita } from '../componentes/basicos';
import { Cuadricula } from '../componentes/Cuadricula';
import { ResumenCorto } from '../componentes/visualizaciones';
import { diaYNumero, diasEntre, rangoSemana, sumarDias } from '../lib/fechas';
import type { Hoy as DatosHoy } from '../tipos';

export function Hoy() {
  const { datos, cargando, error, recargar, setDatos } = useCargar<DatosHoy>('/hoy');
  const [fechaActiva, setFechaActiva] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
        <button className="boton boton-secundario" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    );
  }

  const fecha = fechaActiva ?? datos.hoy;
  const diasAtras = diasEntre(datos.primer_dia_marcable, datos.hoy);
  const marcables = Array.from({ length: diasAtras + 1 }, (_, i) => sumarDias(datos.hoy, -i));

  async function alternar(metaId: string, cumplidoAhora: boolean) {
    if (!datos) return;
    setFallo(null);

    // Actualizacion optimista: la casilla responde antes que la red.
    const previo = datos;
    setDatos({
      ...datos,
      metas: datos.metas.map((m) =>
        m.id !== metaId
          ? m
          : {
              ...m,
              cumplido_hoy: fecha === datos.hoy ? !cumplidoAhora : m.cumplido_hoy,
              dias_cumplidos: cumplidoAhora
                ? m.dias_cumplidos.filter((d) => d !== fecha)
                : [...m.dias_cumplidos, fecha],
            },
      ),
    });

    try {
      await api.crear('/dias', { meta_id: metaId, fecha, cumplido: !cumplidoAhora });
      // Se recarga para traer racha, constancia y logros ya recalculados.
      await recargar();
    } catch (e) {
      setDatos(previo);
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar');
    }
  }

  const pendientes = datos.semanales_pendientes;

  return (
    <div className="contenido">
      {/* --- cabecera compacta --- */}
      <header className="fila-entre">
        <div>
          <h1>
            {datos.termino ? 'Reto terminado' : `Día ${datos.dia_del_reto}`}
            {!datos.termino && <span className="tenue"> de {datos.reto.duracion_dias}</span>}
          </h1>
          <p className="mini">{datos.reto.nombre}</p>
        </div>
        <div className="fila" style={{ gap: 8 }}>
          {datos.racha > 0 && <Etiqueta variante="racha">{datos.racha} días seguidos</Etiqueta>}
          <Etiqueta variante="acento">{datos.constancia}%</Etiqueta>
        </div>
      </header>

      {fallo && <Aviso>{fallo}</Aviso>}

      {/* --- marcado del dia: lo primero y lo mas grande --- */}
      {datos.metas.length === 0 ? (
        <div className="tarjeta pila">
          <h2>Todavía no tenés metas</h2>
          <p className="tenue">
            Creá tu primera meta para empezar a marcar. Podés tener hasta tres activas.
          </p>
          <Link className="boton boton-ancho" to="/metas/nueva">
            Crear mi primera meta
          </Link>
        </div>
      ) : (
        <section className="pila">
          {/* Decision 11.2: se puede marcar hasta dos dias atras. */}
          {marcables.length > 1 && (
            <div className="fila" style={{ gap: 8, overflowX: 'auto' }}>
              {marcables.map((d) => (
                <button
                  key={d}
                  className={`etiqueta ${d === fecha ? 'etiqueta-acento' : ''}`}
                  style={{ border: 'none', cursor: 'pointer', minHeight: 34, padding: '0 12px' }}
                  onClick={() => setFechaActiva(d)}
                >
                  {d === datos.hoy ? 'Hoy' : d === sumarDias(datos.hoy, -1) ? 'Ayer' : diaYNumero(d)}
                </button>
              ))}
            </div>
          )}

          {datos.metas.map((meta) => {
            const cumplida = meta.dias_cumplidos.includes(fecha);
            return (
              <button
                key={meta.id}
                className={cumplida ? 'marca cumplida' : 'marca'}
                onClick={() => void alternar(meta.id, cumplida)}
                aria-pressed={cumplida}
              >
                <span className="marca-caja" aria-hidden="true">
                  <Palomita />
                </span>
                <span className="crece">
                  <span className="marca-titulo">{meta.titulo}</span>
                  <br />
                  <ResumenCorto resultado={meta.resultado} />
                </span>
              </button>
            );
          })}

          {fecha !== datos.hoy && (
            <p className="mini">
              Estas marcando {diaYNumero(fecha)}, no hoy.{' '}
              <button
                className="boton-fantasma"
                style={{ border: 'none', background: 'none', padding: 0, color: 'var(--acento)' }}
                onClick={() => setFechaActiva(null)}
              >
                Volver a hoy
              </button>
            </p>
          )}
        </section>
      )}

      {/* --- registro semanal pendiente --- */}
      {pendientes.length > 0 && (
        <Link to="/semanal" className="tarjeta pila" style={{ color: 'inherit' }}>
          <div className="fila-entre">
            <h2>Registro semanal</h2>
            <Etiqueta variante="racha">{pendientes.length}</Etiqueta>
          </div>
          <p className="tenue">
            {pendientes.length === 1
              ? `Falta "${pendientes[0]?.titulo}" de la semana ${rangoSemana(
                  pendientes[0]?.semana_inicio ?? '',
                  pendientes[0]?.semana_fin ?? '',
                )}.`
              : `Tenes ${pendientes.length} registros semanales sin llenar.`}
          </p>
        </Link>
      )}

      {/* --- frase del dia --- */}
      {datos.frase && (
        <blockquote className="tarjeta" style={{ margin: 0 }}>
          <p style={{ fontSize: '1.05rem', fontStyle: 'italic' }}>{datos.frase}</p>
        </blockquote>
      )}

      {/* --- animos recibidos --- */}
      {datos.animos.length > 0 && (
        <section className="tarjeta pila">
          <h2>Te mandaron ánimos</h2>
          {datos.animos.map((animo) => (
            <div key={animo.id} className="fila">
              <Avatar nombre={animo.de_nombre} foto={animo.de_foto} tamano={32} />
              <span className="crece">
                <strong>{animo.de_nombre}</strong>
                {animo.evento_detalle ? (
                  <span className="tenue"> por "{animo.evento_detalle}"</span>
                ) : (
                  <span className="tenue"> te mando ánimo</span>
                )}
              </span>
            </div>
          ))}
        </section>
      )}

      {/* --- cuadricula --- */}
      <section className="tarjeta pila">
        <h2>Tu mes</h2>
        <Cuadricula
          inicio={datos.reto.fecha_inicio}
          fin={datos.reto.fecha_fin}
          hoy={datos.hoy}
          series={datos.metas.map((m) => ({ titulo: m.titulo, dias: m.dias_cumplidos }))}
        />
      </section>
    </div>
  );
}
