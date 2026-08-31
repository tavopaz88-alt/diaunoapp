import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Aviso, useEnvio } from '../componentes/basicos';

export function Restablecer() {
  const [parametros] = useSearchParams();
  const token = parametros.get('token') ?? '';
  const [clave, setClave] = useState('');
  const [listo, setListo] = useState(false);
  const { ocupado, error, enviar } = useEnvio();
  const navegar = useNavigate();

  if (!token) {
    return (
      <div className="centrado">
        <div className="pila" style={{ width: '100%', maxWidth: 380 }}>
          <h1>Enlace incompleto</h1>
          <p className="tenue">Abri el enlace tal como te llego al correo, sin recortarlo.</p>
          <Link className="boton boton-ancho" to="/recuperar">
            Pedir otro enlace
          </Link>
        </div>
      </div>
    );
  }

  if (listo) {
    return (
      <div className="centrado">
        <div className="pila" style={{ width: '100%', maxWidth: 380 }}>
          <h1>Contraseña cambiada</h1>
          <p className="tenue">Ya podés entrar con la nueva.</p>
          <button className="boton boton-ancho" onClick={() => navegar('/entrar', { replace: true })}>
            Entrar
          </button>
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
            await api.crear('/restablecer', { token, password: clave });
          });
          if (ok) setListo(true);
        }}
      >
        <h1>Nueva contraseña</h1>

        {error && <Aviso>{error}</Aviso>}

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
          {ocupado ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </div>
  );
}
