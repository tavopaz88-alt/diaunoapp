/**
 * Administracion (seccion 6.9).
 *
 * Lo que NO hay aqui, a proposito: una tabla de constancia de todos. El
 * administrador tampoco ve quien va ultimo, ni los datos de metas privadas.
 * La API ni siquiera se los devuelve.
 */

import { useEffect, useState } from 'react';
import { api, ErrorApi } from '../lib/api';
import { useCargar, Aviso, Avatar, Cargando, Etiqueta } from '../componentes/basicos';
import { fechaCorta, fechaLarga } from '../lib/fechas';
import { useSesion } from '../lib/sesion';
import type { Frase, Participante, Reto } from '../tipos';

interface DatosReto {
  reto: Reto & { codigo_acceso: string; activo: boolean };
  participantes: number;
}

interface DatosFrases {
  hoy: string;
  reto: Reto;
  frases: Frase[];
}

export function Admin() {
  const { perfil } = useSesion();
  const reto = useCargar<DatosReto>('/admin/reto');
  const frases = useCargar<DatosFrases>('/admin/frases');
  const gente = useCargar<{ participantes: Participante[] }>('/admin/participantes');

  const [fecha, setFecha] = useState('');
  const [texto, setTexto] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [nombreReto, setNombreReto] = useState('');
  const [inicioReto, setInicioReto] = useState('');
  const [duracionReto, setDuracionReto] = useState(30);
  const [alinearIngresos, setAlinearIngresos] = useState(false);

  // Precarga del formulario del reto. Va antes de los retornos tempranos para
  // que el orden de los hooks no cambie entre renders.
  const datosDelReto = reto.datos?.reto;
  useEffect(() => {
    if (!datosDelReto) return;
    setNombreReto(datosDelReto.nombre);
    setInicioReto(datosDelReto.fecha_inicio);
    setDuracionReto(datosDelReto.duracion_dias);
  }, [datosDelReto]);

  if (reto.cargando || frases.cargando || gente.cargando) return <Cargando />;
  if (!reto.datos || !frases.datos || !gente.datos) {
    return (
      <div className="contenido">
        <Aviso>{reto.error ?? frases.error ?? gente.error ?? 'No se pudo cargar'}</Aviso>
      </div>
    );
  }

  const datosReto = reto.datos;

  async function accion(hacer: () => Promise<void>, exito: string) {
    setFallo(null);
    setMensaje(null);
    try {
      await hacer();
      setMensaje(exito);
    } catch (e) {
      setFallo(e instanceof ErrorApi ? e.message : 'No se pudo completar');
    }
  }

  const hoy = frases.datos.hoy;
  const proximas = frases.datos.frases.filter((f) => f.fecha >= hoy);
  const pasadas = frases.datos.frases.filter((f) => f.fecha < hoy);
  const hayDeHoy = frases.datos.frases.some((f) => f.fecha === hoy);

  return (
    <div className="contenido">
      <header>
        <h1>Administración</h1>
      </header>

      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}
      {fallo && <Aviso>{fallo}</Aviso>}

      {/* --- codigo de invitacion --- */}
      <section className="tarjeta pila">
        <h2>Código de invitación</h2>
        <p className="mini">
          Sin este código nadie se puede registrar. Compartilo solo con quienes van a participar.
        </p>
        <div className="tarjeta-plana" style={{ textAlign: 'center' }}>
          <p className="numerote" style={{ letterSpacing: '0.15em', fontSize: '2rem' }}>
            {datosReto.reto.codigo_acceso}
          </p>
        </div>
        <div className="fila">
          <button
            className="boton boton-secundario crece"
            onClick={() =>
              void accion(async () => {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/registro?codigo=${datosReto.reto.codigo_acceso}`,
                );
              }, 'Enlace de invitación copiado')
            }
          >
            Copiar enlace
          </button>
          <button
            className="boton boton-fantasma"
            onClick={() =>
              void accion(async () => {
                await api.crear('/admin/reto/codigo');
                await reto.recargar();
              }, 'Código cambiado. El anterior ya no sirve.')
            }
          >
            Cambiar
          </button>
        </div>
      </section>

      {/* --- frase del dia --- */}
      <section className="tarjeta pila">
        <h2>Frase del día</h2>
        {!hayDeHoy && (
          <p className="mini" style={{ color: 'var(--racha)' }}>
            Hoy no hay frase publicada. Sin frase, el correo diario no sale.
          </p>
        )}

        <div className="campo">
          <label htmlFor="fecha">Para el día</label>
          <input
            id="fecha"
            type="date"
            value={fecha || hoy}
            min={datosReto.reto.fecha_inicio}
            max={datosReto.reto.fecha_fin}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="texto">Frase</label>
          <textarea
            id="texto"
            maxLength={500}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <span className="pista">
            Se puede programar con anticipacion. Una por dia; volver a guardar la reemplaza.
          </span>
        </div>

        <button
          className="boton"
          disabled={!texto.trim()}
          onClick={() =>
            void accion(async () => {
              await api.crear('/admin/frases', { fecha: fecha || hoy, texto });
              setTexto('');
              await frases.recargar();
            }, 'Frase guardada')
          }
        >
          Guardar frase
        </button>

        {proximas.length > 0 && (
          <>
            <hr className="separador" />
            <h3 className="tenue">Programadas</h3>
            {proximas.map((f) => (
              <div key={f.id} className="tarjeta-plana pila">
                <div className="fila-entre">
                  <span className="mini">
                    {fechaLarga(f.fecha)}
                    {f.fecha === hoy && ' · hoy'}
                  </span>
                  <button
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--peligro)',
                      cursor: 'pointer',
                      minHeight: 40,
                    }}
                    onClick={() =>
                      void accion(async () => {
                        await api.borrar(`/admin/frases/${f.id}`);
                        await frases.recargar();
                      }, 'Frase eliminada')
                    }
                  >
                    Quitar
                  </button>
                </div>
                <p style={{ fontStyle: 'italic' }}>{f.texto}</p>
              </div>
            ))}
          </>
        )}

        {pasadas.length > 0 && (
          <details>
            <summary className="mini" style={{ cursor: 'pointer', minHeight: 40, paddingTop: 10 }}>
              Ver las {pasadas.length} frases anteriores
            </summary>
            <div className="pila" style={{ marginTop: 12 }}>
              {pasadas.map((f) => (
                <div key={f.id} className="tarjeta-plana">
                  <p className="mini">{fechaCorta(f.fecha)}</p>
                  <p style={{ fontStyle: 'italic' }}>{f.texto}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      {/* --- participantes --- */}
      <section className="tarjeta pila">
        <div className="fila-entre">
          <h2>Participantes</h2>
          <Etiqueta>{gente.datos.participantes.length}</Etiqueta>
        </div>
        <p className="mini">
          Esta lista sirve para gestionar, no para comparar: no muestra constancia ni orden por
          avance. Nadie ve quien va último, tampoco vos.
        </p>

        {gente.datos.participantes.map((p) => (
          <div key={p.id} className="tarjeta-plana fila">
            <Avatar nombre={p.nombre} foto={p.foto_url} tamano={40} />
            <div className="crece">
              <p>
                <strong>{p.nombre}</strong>
                {p.es_admin && <Etiqueta variante="acento"> admin</Etiqueta>}
              </p>
              <p className="mini">
                {p.email} · desde el {fechaCorta(p.fecha_ingreso)} · {p.metas_activas} meta(s)
              </p>
            </div>

            {p.id !== perfil?.id && (
              <div className="pila" style={{ gap: 6 }}>
                <button
                  className="boton boton-secundario boton-chico"
                  onClick={() =>
                    void accion(
                      async () => {
                        await api.actualizar(`/admin/participantes/${p.id}`, {
                          es_admin: !p.es_admin,
                        });
                        await gente.recargar();
                      },
                      p.es_admin ? 'Ya no es administrador' : 'Ahora es administrador',
                    )
                  }
                >
                  {p.es_admin ? 'Quitar admin' : 'Hacer admin'}
                </button>
                <button
                  className="boton boton-peligro boton-chico"
                  onClick={() => {
                    if (!window.confirm(`Sacar a ${p.nombre} del reto? Su cuenta no se borra.`)) return;
                    void accion(async () => {
                      await api.borrar(`/admin/participantes/${p.id}`);
                      await gente.recargar();
                    }, `${p.nombre} salio del reto`);
                  }}
                >
                  Sacar
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {/* --- el reto --- */}
      <section className="tarjeta pila">
        <h2>El reto</h2>
        <p className="mini">
          Ahora mismo: del {fechaLarga(datosReto.reto.fecha_inicio)} al{' '}
          {fechaLarga(datosReto.reto.fecha_fin)} · {datosReto.reto.duracion_dias} días
        </p>

        <div className="campo">
          <label htmlFor="reto-nombre">Nombre</label>
          <input
            id="reto-nombre"
            maxLength={120}
            value={nombreReto}
            onChange={(e) => setNombreReto(e.target.value)}
          />
        </div>

        <div className="fila">
          <div className="campo crece">
            <label htmlFor="reto-inicio">Arranca</label>
            <input
              id="reto-inicio"
              type="date"
              value={inicioReto}
              onChange={(e) => setInicioReto(e.target.value)}
            />
          </div>
          <div className="campo" style={{ width: 110 }}>
            <label htmlFor="reto-duracion">Días</label>
            <input
              id="reto-duracion"
              type="number"
              min={7}
              max={365}
              value={duracionReto}
              onChange={(e) => setDuracionReto(Number(e.target.value))}
            />
          </div>
        </div>

        {/*
          Mover el arranque hacia atrás no basta por sí solo: la constancia de
          cada quien se mide desde su fecha de ingreso, no desde la del reto.
        */}
        <label className="fila" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
          <input
            type="checkbox"
            checked={alinearIngresos}
            style={{ width: 22, height: 22, flex: 'none', marginTop: 2 }}
            onChange={(e) => setAlinearIngresos(e.target.checked)}
          />
          <span className="crece">
            <strong>Alinear las fechas de ingreso</strong>
            <br />
            <span className="mini">
              Marcá esto si el reto ya venía corriendo antes de configurar la app. Mueve al
              arranque a quienes ingresaron después, para que sus días anteriores cuenten y se
              puedan marcar. A quien entró tarde de verdad no lo toca.
            </span>
          </span>
        </label>

        <button
          className="boton"
          disabled={!nombreReto.trim() || !inicioReto}
          onClick={() =>
            void accion(async () => {
              const r = await api.actualizar<{ ingresos_movidos: number }>('/admin/reto', {
                nombre: nombreReto,
                fecha_inicio: inicioReto,
                duracion_dias: duracionReto,
                alinear_ingresos: alinearIngresos,
              });
              await reto.recargar();
              await gente.recargar();
              if (r.ingresos_movidos > 0) {
                setMensaje(`Reto actualizado · ${r.ingresos_movidos} ingreso(s) alineado(s)`);
              }
            }, 'Reto actualizado')
          }
        >
          Guardar cambios del reto
        </button>
      </section>
    </div>
  );
}
