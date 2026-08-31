/**
 * Cliente de la API.
 *
 * La sesion viaja en una cookie HttpOnly del mismo origen, asi que aqui no se
 * guarda ningun token: basta con `credentials: 'same-origin'`.
 */

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      credentials: 'same-origin',
      ...opciones,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión. Revisa tu internet e intenta de nuevo.');
  }

  if (respuesta.status === 204) return undefined as T;

  const tipo = respuesta.headers.get('content-type') ?? '';
  const datos = tipo.includes('application/json') ? await respuesta.json() : null;

  if (!respuesta.ok) {
    const mensaje =
      (datos && typeof datos === 'object' && 'error' in datos && String(datos.error)) ||
      'Algo salió mal. Intenta de nuevo.';
    throw new ErrorApi(respuesta.status, mensaje);
  }

  return datos as T;
}

function conCuerpo(metodo: string) {
  return <T>(ruta: string, cuerpo?: unknown) =>
    pedir<T>(ruta, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo ?? {}),
    });
}

export const api = {
  obtener: <T>(ruta: string) => pedir<T>(ruta),
  crear: conCuerpo('POST'),
  actualizar: conCuerpo('PATCH'),
  borrar: conCuerpo('DELETE'),

  /** La foto va como binario crudo, ya recortada por el cliente. */
  subirFoto: (blob: Blob) =>
    pedir<{ ok: boolean; foto_url: string }>('/perfil/foto', {
      method: 'POST',
      headers: { 'Content-Type': blob.type },
      body: blob,
    }),
};
