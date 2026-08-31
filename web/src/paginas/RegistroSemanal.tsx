/**
 * Registro semanal: un campo por meta, adaptado al tipo (seccion 6.7).
 * Se puede llenar con retraso, nunca por adelantado.
 */

import { useState } from 'react';
import { api, ErrorApi } from '../lib/api';
import { useCargar, Aviso, Cargando, Etiqueta, Vacio } from '../componentes/basicos';
import { rangoSemana } from '../lib/fechas';
import type { DatosSemanas, MetaSemanal, Semana } from '../tipos';

function etiquetaDelCampo(meta: MetaSemanal): string {
  switch (meta.tipo) {
    case 'acumulativo':
      return `Cuantas ${meta.unidad} esta semana`;
    case 'medicion':
      return `Valor actual en ${meta.unidad}`;
    default:
      return 'Qué lograste esta semana';
  }
}

export function RegistroSemanal() {
  const { datos, cargando, error, recargar } = useCargar<DatosSemanas>('/semanas');
  const [semanaActiva, setSemanaActiva] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  if (cargando) return <Cargando />;
  if (error || !datos) {
    return (
      <div className="contenido">
        <Aviso>{error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  const registrables: Semana[] = datos.semanas.filter((s) => datos.registrables.includes(s.clave));

  if (registrables.length === 0) {
    return (
      <div className="contenido">
        <h1>Registro semanal</h1>
        <Vacio>
          Todavía no cierra ninguna semana. El registro aparece cuando termina la semana, los
          domingos.
        </Vacio>
      </div>
    );
  }

  if (datos.metas.length === 0) {
    return (
      <div className="contenido">
        <h1>Registro semanal</h1>
        <Vacio>
          Tus metas son de tipo hábito: solo llevan constancia diaria, no piden nada semanal.
        </Vacio>
      </div>
    );
  }

  // Por defecto, la ultima semana cerrada.
  const clave = semanaActiva ?? registrables[registrables.length - 1]?.clave ?? '';
  const semana = registrables.find((s) => s.clave === clave);

  async function guardar(meta: MetaSemanal) {
    if (!semana) return;
    const bruto = (valores[`${meta.id}:${clave}`] ?? '').trim();
    if (!bruto) return;

    setGuardando(meta.id);
    setFallo(null);
    setListo(null);
    try {
      await api.crear('/semanas', {
        meta_id: meta.id,
        semana_inicio: clave,
        ...(meta.tipo === 'hito' ? { texto: bruto } : { valor: Number(bruto) }),
      });
      setListo(meta.id);
      await recargar();
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="contenido">
      <header className="pila">
        <h1>Registro semanal</h1>
        {semana && <p className="tenue">Semana {semana.numero} · {rangoSemana(semana.inicio, semana.fin)}</p>}
      </header>

      {registrables.length > 1 && (
        <div className="fila" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {registrables.map((s) => (
            <button
              key={s.clave}
              className={`etiqueta ${s.clave === clave ? 'etiqueta-acento' : ''}`}
              style={{ border: 'none', cursor: 'pointer', minHeight: 34, padding: '0 12px' }}
              onClick={() => setSemanaActiva(s.clave)}
            >
              Semana {s.numero}
            </button>
          ))}
        </div>
      )}

      {fallo && <Aviso>{fallo}</Aviso>}

      <div className="pila">
        {datos.metas.map((meta) => {
          const existente = meta.registros.find((r) => r.semana_inicio === clave);
          const campo = `${meta.id}:${clave}`;
          const valor =
            valores[campo] ??
            (existente ? String(existente.texto ?? existente.valor ?? '') : '');

          return (
            <section key={meta.id} className="tarjeta pila">
              <div className="fila-entre">
                <h2 className="crece">{meta.titulo}</h2>
                {existente && <Etiqueta variante="acento">registrada</Etiqueta>}
              </div>

              <div className="campo">
                <label htmlFor={campo}>{etiquetaDelCampo(meta)}</label>
                {meta.tipo === 'hito' ? (
                  <textarea
                    id={campo}
                    maxLength={500}
                    placeholder="En tus palabras: qué produjiste, que quedo hecho"
                    value={valor}
                    onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                  />
                ) : (
                  <input
                    id={campo}
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={meta.tipo === 'acumulativo' ? 0 : undefined}
                    value={valor}
                    onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                  />
                )}

                {meta.tipo === 'acumulativo' && (
                  <span className="pista">
                    Solo lo de esta semana, no el total. La app lo suma sola.
                  </span>
                )}
                {meta.tipo === 'medicion' && (
                  <span className="pista">
                    El valor de hoy. Empezaste en {meta.valor_inicial} y vas hacia{' '}
                    {meta.valor_objetivo} {meta.unidad}.
                  </span>
                )}
              </div>

              <button
                className="boton boton-ancho"
                disabled={guardando === meta.id}
                onClick={() => void guardar(meta)}
              >
                {guardando === meta.id
                  ? 'Guardando...'
                  : listo === meta.id
                    ? 'Guardado'
                    : existente
                      ? 'Actualizar'
                      : 'Guardar'}
              </button>
            </section>
          );
        })}
      </div>
    </div>
  );
}
