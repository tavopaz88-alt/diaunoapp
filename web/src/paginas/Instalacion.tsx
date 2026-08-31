/**
 * Primer arranque: crea el administrador y el reto.
 * Solo funciona con la base vacia y con el token de instalacion configurado
 * como secreto del Worker.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { Aviso, useEnvio } from '../componentes/basicos';

export function Instalacion() {
  const [token, setToken] = useState('');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [nombreReto, setNombreReto] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [duracion, setDuracion] = useState(30);
  const [codigo, setCodigo] = useState<string | null>(null);

  const { ocupado, error, enviar } = useEnvio();
  const { recargar } = useSesion();
  const navegar = useNavigate();

  if (codigo) {
    return (
      <div className="centrado">
        <div className="pila" style={{ width: '100%', maxWidth: 420 }}>
          <h1>Listo</h1>
          <p className="tenue">
            Este es el código de invitación del reto. Compartilo con quienes van a participar: sin
            el no se pueden registrar.
          </p>
          <div className="tarjeta" style={{ textAlign: 'center' }}>
            <p className="numerote" style={{ letterSpacing: '0.15em' }}>
              {codigo}
            </p>
          </div>
          <p className="mini">Lo podés ver y cambiar despues desde Administración.</p>
          <button
            className="boton boton-ancho"
            onClick={async () => {
              await recargar();
              navegar('/', { replace: true });
            }}
          >
            Empezar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="centrado">
      <form
        className="pila"
        style={{ width: '100%', maxWidth: 420 }}
        onSubmit={async (e) => {
          e.preventDefault();
          await enviar(async () => {
            const respuesta = await api.crear<{ codigo_acceso: string }>('/setup', {
              token,
              nombre,
              email,
              password: clave,
              reto_nombre: nombreReto,
              fecha_inicio: fechaInicio,
              duracion_dias: duracion,
            });
            setCodigo(respuesta.codigo_acceso);
          });
        }}
      >
        <div>
          <h1>Instalar</h1>
          <p className="tenue">Se crea la cuenta de administrador y el primer reto.</p>
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="campo">
          <label htmlFor="token">Token de instalación</label>
          <input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
          <span className="pista">
            El secreto SETUP_TOKEN que configuraste en el Worker.
          </span>
        </div>

        <hr className="separador" />

        <div className="campo">
          <label htmlFor="nombre">Tu nombre</label>
          <input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <div className="campo">
          <label htmlFor="email">Tu correo</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="clave">Tu contraseña</label>
          <input
            id="clave"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>

        <hr className="separador" />

        <div className="campo">
          <label htmlFor="reto">Nombre del reto</label>
          <input
            id="reto"
            required
            placeholder="Reto de 30 días"
            value={nombreReto}
            onChange={(e) => setNombreReto(e.target.value)}
          />
        </div>

        <div className="fila">
          <div className="campo crece">
            <label htmlFor="inicio">Arranca</label>
            <input
              id="inicio"
              type="date"
              required
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="campo" style={{ width: 110 }}>
            <label htmlFor="duracion">Días</label>
            <input
              id="duracion"
              type="number"
              min={7}
              max={365}
              required
              value={duracion}
              onChange={(e) => setDuracion(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Instalando...' : 'Instalar'}
        </button>
      </form>
    </div>
  );
}
