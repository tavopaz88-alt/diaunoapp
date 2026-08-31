import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { Aviso, useEnvio } from '../componentes/basicos';

export function Registro() {
  const [parametros] = useSearchParams();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  // El codigo puede venir en el enlace de invitacion: un paso menos.
  const [codigo, setCodigo] = useState(parametros.get('codigo') ?? '');
  const { ocupado, error, enviar } = useEnvio();
  const { recargar } = useSesion();
  const navegar = useNavigate();

  return (
    <div className="centrado">
      <form
        className="pila"
        style={{ width: '100%', maxWidth: 380 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await enviar(async () => {
            await api.crear('/registro', { nombre, email, password: clave, codigo });
          });
          if (ok) {
            await recargar();
            navegar('/', { replace: true });
          }
        }}
      >
        <div>
          <h1>Unirte al reto</h1>
          <p className="tenue">Necesitas el código que comparte quien organiza.</p>
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="campo">
          <label htmlFor="codigo">Código de invitación</label>
          <input
            id="codigo"
            required
            autoCapitalize="characters"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            style={{ letterSpacing: '0.12em', fontWeight: 600 }}
          />
        </div>

        <div className="campo">
          <label htmlFor="nombre">Tu nombre</label>
          <input
            id="nombre"
            required
            autoComplete="name"
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <span className="pista">Así te ven los demas participantes.</span>
        </div>

        <div className="campo">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
          <span className="pista">Mínimo 8 caracteres.</span>
        </div>

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Creando cuenta...' : 'Crear mi cuenta'}
        </button>

        <Link className="mini" to="/entrar">
          Ya tengo cuenta
        </Link>
      </form>
    </div>
  );
}
