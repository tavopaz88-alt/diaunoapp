/** Tenes cuenta pero no estas en el reto activo: hace falta el codigo. */

import { useState } from 'react';
import { api } from '../lib/api';
import { useSesion } from '../lib/sesion';
import { Aviso, useEnvio } from '../componentes/basicos';

export function Unirse() {
  const [codigo, setCodigo] = useState('');
  const { ocupado, error, enviar } = useEnvio();
  const { perfil, recargar, salir } = useSesion();

  return (
    <div className="centrado">
      <form
        className="pila"
        style={{ width: '100%', maxWidth: 380 }}
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await enviar(async () => {
            await api.crear('/perfil/unirse', { codigo });
          });
          if (ok) await recargar();
        }}
      >
        <div>
          <h1>Hola, {perfil?.nombre}</h1>
          <p className="tenue">
            Tu cuenta existe, pero no estás dentro del reto que esta corriendo. Escribi el código
            que te compartieron.
          </p>
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

        <button className="boton boton-ancho" type="submit" disabled={ocupado}>
          {ocupado ? 'Entrando...' : 'Unirme'}
        </button>

        <button type="button" className="boton boton-fantasma" onClick={() => void salir()}>
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
