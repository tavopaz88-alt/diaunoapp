/** Sesion global: quien esta dentro, en que reto y si ya se inscribio. */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ErrorApi } from './api';
import type { Perfil, Reto } from '../tipos';

interface RespuestaYo {
  perfil: Perfil;
  reto: Reto | null;
  inscrito: boolean;
  aparece_en_ranking: boolean;
  hoy: string;
}

interface Estado {
  cargando: boolean;
  perfil: Perfil | null;
  reto: Reto | null;
  inscrito: boolean;
  apareceEnRanking: boolean;
  hoy: string;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Estado | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState<RespuestaYo | null>(null);

  const recargar = useCallback(async () => {
    try {
      setDatos(await api.obtener<RespuestaYo>('/yo'));
    } catch (error) {
      // Un 401 no es un fallo: solo significa que nadie ha iniciado sesion.
      if (!(error instanceof ErrorApi) || error.estado !== 401) console.error(error);
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const salir = useCallback(async () => {
    await api.crear('/salir');
    setDatos(null);
  }, []);

  const valor = useMemo<Estado>(
    () => ({
      cargando,
      perfil: datos?.perfil ?? null,
      reto: datos?.reto ?? null,
      inscrito: datos?.inscrito ?? false,
      apareceEnRanking: datos?.aparece_en_ranking ?? true,
      hoy: datos?.hoy ?? '',
      recargar,
      salir,
    }),
    [cargando, datos, recargar, salir],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): Estado {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useSesion tiene que usarse dentro de ProveedorSesion');
  return valor;
}
