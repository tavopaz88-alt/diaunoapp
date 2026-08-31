import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { Aviso, useCargar, useEnvio } from '../componentes/basicos';

interface Estado {
  instalado: boolean;
  reto: { nombre: string; fecha_inicio: string; fecha_fin: string; duracion_dias: number } | null;
}

export function Entrar() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const { ocupado, error, enviar } = useEnvio();
  const { recargar } = useSesion();
  const navegar = useNavigate();
  const { datos: estado } = useCargar<Estado>('/estado');

  // Base vacia: lo unico que se puede hacer es instalar.
  if (estado && !estado.instalado) {
    return (
      <div className="centrado">
        <div className="pila" style={{ width: '100%', maxWidth: 380 }}>
          <h1>Aún no hay nada aquí</h1>
          <p className="tenue">
            La aplicación no tiene ningun administrador todavía. El primer paso es crear la cuenta
            de administrador y el reto.
          </p>
          <Link className="boton boton-ancho" to="/instalar">
            Instalar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="centrado">
      <form
        className="pila"
        style={{ width: '100%', maxWidth: 380 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await enviar(async () => {
            await api.crear('/login', { email, password: clave });
          });
          if (ok) {
            await recargar();
            navegar('/', { replace: true });
          }
        }}
      >
        <div>
          <h1>{estado?.reto?.nombre ?? 'Reto'}</h1>
          <p className="tenue">Entrá para marcar tu día.</p>
        </div>

        {error && <Aviso>{error}</Aviso>}

        <div className="campo">
          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
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
            autoComplete="current-password"
            required
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="fila-entre">
          <Link className="mini" to="/recuperar">
            Olvidé mi contraseña
          </Link>
          <Link className="mini" to="/registro">
            Tengo un código de invitación
          </Link>
        </div>
      </form>
    </div>
  );
}
