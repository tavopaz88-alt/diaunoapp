/**
 * Perfil propio (seccion 6.2) y los derechos sobre los datos (criterio 12):
 * exportarlos y borrar la cuenta.
 */

import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../lib/api';
import { recortarCuadrado } from '../lib/foto';
import { useSesion } from '../lib/sesion';
import { Aviso, Avatar, useEnvio } from '../componentes/basicos';

export function MiPerfil() {
  const { perfil, reto, apareceEnRanking, recargar, salir } = useSesion();
  const entradaFoto = useRef<HTMLInputElement>(null);

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const [claveActual, setClaveActual] = useState('');
  const [claveNueva, setClaveNueva] = useState('');
  const [ranking, setRanking] = useState(apareceEnRanking);
  const [borrando, setBorrando] = useState(false);
  const [claveBaja, setClaveBaja] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const { ocupado, error, enviar } = useEnvio();

  if (!perfil) return null;

  async function subirFoto(archivo: File) {
    setSubiendo(true);
    setFallo(null);
    try {
      await api.subirFoto(await recortarCuadrado(archivo));
      await recargar();
      setMensaje('Foto actualizada');
    } catch (e) {
      setFallo(e instanceof ErrorApi || e instanceof Error ? e.message : 'No se pudo subir la foto');
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="contenido">
      <header className="fila">
        <Avatar nombre={perfil.nombre} foto={perfil.foto_url} tamano={64} />
        <div className="crece">
          <h1>{perfil.nombre}</h1>
          <p className="mini">{perfil.email}</p>
        </div>
      </header>

      {mensaje && <Aviso tipo="ok">{mensaje}</Aviso>}
      {(fallo || error) && <Aviso>{fallo ?? error}</Aviso>}

      {/* --- foto --- */}
      <section className="tarjeta pila">
        <h2>Foto</h2>
        <input
          ref={entradaFoto}
          type="file"
          accept="image/*"
          className="sr-solo"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void subirFoto(archivo);
            e.target.value = '';
          }}
        />
        <p className="mini">Se recorta en cuadrado y se reduce antes de subir.</p>
        <div className="fila">
          <button
            className="boton boton-secundario crece"
            disabled={subiendo}
            onClick={() => entradaFoto.current?.click()}
          >
            {subiendo ? 'Subiendo...' : perfil.foto_url ? 'Cambiar foto' : 'Subir foto'}
          </button>
          {perfil.foto_url && (
            <button
              className="boton boton-fantasma"
              onClick={async () => {
                await api.borrar('/perfil/foto');
                await recargar();
              }}
            >
              Quitar
            </button>
          )}
        </div>
      </section>

      {/* --- nombre --- */}
      <section className="tarjeta pila">
        <h2>Nombre</h2>
        <div className="campo">
          <label htmlFor="nombre">Cómo te ven los demas</label>
          <input id="nombre" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <button
          className="boton"
          disabled={ocupado || nombre.trim() === perfil.nombre}
          onClick={async () => {
            const ok = await enviar(async () => {
              await api.actualizar('/perfil', { nombre });
            });
            if (ok) {
              await recargar();
              setMensaje('Nombre actualizado');
            }
          }}
        >
          Guardar
        </button>
      </section>

      {/* --- privacidad y ranking --- */}
      <section className="tarjeta pila">
        <h2>Privacidad</h2>
        <p className="mini">
          La visibilidad se elige meta por meta, al crearla o editarla. Tu constancia siempre es
          visible para el grupo: dice que cumpliste, no qué cumpliste.
        </p>
        <Link className="boton boton-secundario boton-ancho" to="/metas">
          Ver la visibilidad de mis metas
        </Link>

        <hr className="separador" />

        <label className="fila" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ranking}
            style={{ width: 22, height: 22, flex: 'none' }}
            onChange={async (e) => {
              const valor = e.target.checked;
              setRanking(valor);
              await api.actualizar('/perfil/ranking', { aparece_en_ranking: valor });
              await recargar();
            }}
          />
          <span className="crece">
            <strong>Aparecer en el ranking</strong>
            <br />
            <span className="mini">
              Si lo apagas seguís participando y el muro sigue celebrando tus logros, pero no
              apareces en el top ni recibis una posicion.
            </span>
          </span>
        </label>
      </section>

      {/* --- contrasena --- */}
      <section className="tarjeta pila">
        <h2>Contraseña</h2>
        <div className="campo">
          <label htmlFor="actual">Contraseña actual</label>
          <input
            id="actual"
            type="password"
            autoComplete="current-password"
            value={claveActual}
            onChange={(e) => setClaveActual(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="nueva">Contraseña nueva</label>
          <input
            id="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={claveNueva}
            onChange={(e) => setClaveNueva(e.target.value)}
          />
        </div>
        <button
          className="boton"
          disabled={ocupado || !claveActual || claveNueva.length < 8}
          onClick={async () => {
            const ok = await enviar(async () => {
              await api.crear('/perfil/clave', { actual: claveActual, nueva: claveNueva });
            });
            if (ok) {
              setClaveActual('');
              setClaveNueva('');
              setMensaje('Contraseña cambiada. Las demás sesiones se cerraron.');
            }
          }}
        >
          Cambiar contraseña
        </button>
      </section>

      {perfil.es_admin && (
        <Link className="boton boton-secundario boton-ancho" to="/admin">
          Administración
        </Link>
      )}

      {/* --- datos --- */}
      <section className="tarjeta pila">
        <h2>Tus datos</h2>
        <p className="mini">
          Son tuyos. Podés descargarlos completos o borrar la cuenta cuando quieras.
        </p>
        <a className="boton boton-secundario boton-ancho" href="/api/perfil/exportar">
          Descargar mis datos
        </a>

        {!borrando ? (
          <button className="boton boton-fantasma" onClick={() => setBorrando(true)}>
            Borrar mi cuenta
          </button>
        ) : (
          <div className="pila">
            <p className="tenue">
              Se borran tu perfil, tus metas y todos tus registros. No hay forma de recuperarlos.
              Escribi tu contraseña para confirmar.
            </p>
            <div className="campo">
              <label htmlFor="baja">Contraseña</label>
              <input
                id="baja"
                type="password"
                value={claveBaja}
                onChange={(e) => setClaveBaja(e.target.value)}
              />
            </div>
            <div className="fila">
              <button
                className="boton boton-peligro crece"
                disabled={ocupado || !claveBaja}
                onClick={async () => {
                  const ok = await enviar(async () => {
                    await api.borrar('/perfil', { password: claveBaja });
                  });
                  if (ok) window.location.href = '/';
                }}
              >
                Borrar definitivamente
              </button>
              <button className="boton boton-secundario crece" onClick={() => setBorrando(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>

      <button className="boton boton-secundario boton-ancho" onClick={() => void salir()}>
        Cerrar sesión
      </button>

      {reto && (
        <p className="mini" style={{ textAlign: 'center' }}>
          {reto.nombre} · {reto.duracion_dias} días
        </p>
      )}
    </div>
  );
}
