/** Piezas chicas que se repiten en todas las pantallas. */

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ErrorApi } from '../lib/api';

export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="cargando" role="status">
      {texto}
    </div>
  );
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok'; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}

export function Etiqueta({
  children,
  variante,
}: {
  children: ReactNode;
  variante?: 'acento' | 'racha';
}) {
  const clase = variante ? `etiqueta etiqueta-${variante}` : 'etiqueta';
  return <span className={clase}>{children}</span>;
}

export function Barra({ porcentaje }: { porcentaje: number }) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  return (
    <div
      className="barra"
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${valor}%` }} />
    </div>
  );
}

export function Avatar({
  nombre,
  foto,
  tamano = 40,
}: {
  nombre: string;
  foto?: string | null;
  tamano?: number;
}) {
  const estilo = { width: tamano, height: tamano, fontSize: Math.round(tamano * 0.4) };

  if (foto) {
    return <img className="avatar" src={foto} alt="" style={estilo} loading="lazy" />;
  }
  return (
    <div className="avatar" style={estilo} aria-hidden="true">
      {nombre.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

export function Palomita() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Carga de datos con estados de cargando y error, y opcion de recargar. */
export function useCargar<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!ruta) return;
    setError(null);
    try {
      setDatos(await api.obtener<T>(ruta));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo cargar');
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  useEffect(() => {
    setCargando(true);
    void recargar();
  }, [recargar]);

  return { datos, cargando, error, recargar, setDatos };
}

/** Estado de envio de formularios: ocupado + mensaje de error. */
export function useEnvio() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = useCallback(async (accion: () => Promise<void>) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'Algo salió mal');
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);

  return { ocupado, error, setError, enviar };
}
