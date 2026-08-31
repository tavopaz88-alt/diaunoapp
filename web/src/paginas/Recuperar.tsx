import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Aviso, useEnvio } from '../componentes/basicos';

export function Recuperar() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const { ocupado, error, enviar } = useEnvio();

  if (enviado) {
    return (
      <div className="centrado">
        <div className="pila" style={{ width: '100%', maxWidth: 380 }}>
          <h1>Revisa tu correo</h1>
          {/* Se responde igual exista o no la cuenta: no delata que correos
              estan registrados. */}
          <p className="tenue">
            Si ese correo tiene una cuenta, te llego un enlace para cambiar la contraseña. Vence en
            una hora.
          </p>
          <Link className="boton boton-secundario boton-ancho" to="/entrar">
            Volver
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
            await api.crear('/recuperar', { email });
          });
          if (ok) setEnviado(true);
        }}
      >
        <div>
          <h1>Recuperar acceso</h1>
          <p className="tenue">Te mandamos un enlace para poner una contraseña nueva.</p>
        </div>

        {error && <Aviso>{error}</Aviso>}

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

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Enviando...' : 'Enviar enlace'}
        </button>

        <Link className="mini" to="/entrar">
          Volver a entrar
        </Link>
      </form>
    </div>
  );
}
