/** Barra inferior. Movil primero: el pulgar llega abajo, no arriba. */

import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

function Enlace({ a, texto, children }: { a: string; texto: string; children: ReactNode }) {
  return (
    <NavLink to={a} className={({ isActive }) => (isActive ? 'nav-enlace activo' : 'nav-enlace')} end>
      {children}
      <span>{texto}</span>
    </NavLink>
  );
}

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function Navegacion() {
  return (
    <nav className="navegacion" aria-label="Principal">
      <div>
        <Enlace a="/" texto="Hoy">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" {...trazo} />
            <path d="M8 3v4M16 3v4M8 14l3 3 5-5" {...trazo} />
          </svg>
        </Enlace>

        <Enlace a="/metas" texto="Metas">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" {...trazo} />
            <circle cx="12" cy="12" r="4.5" {...trazo} />
            <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          </svg>
        </Enlace>

        <Enlace a="/comunidad" texto="Comunidad">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.2" {...trazo} />
            <path d="M3.5 19a5.5 5.5 0 0 1 11 0" {...trazo} />
            <path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 19a5.5 5.5 0 0 0-2-4.2" {...trazo} />
          </svg>
        </Enlace>

        <Enlace a="/resumen" texto="Resumen">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" {...trazo} />
          </svg>
        </Enlace>

        <Enlace a="/perfil" texto="Perfil">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="8" r="3.5" {...trazo} />
            <path d="M4.5 20a7.5 7.5 0 0 1 15 0" {...trazo} />
          </svg>
        </Enlace>
      </div>
    </nav>
  );
}
