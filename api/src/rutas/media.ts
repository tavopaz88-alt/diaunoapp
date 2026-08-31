/**
 * Fotos de perfil desde R2.
 *
 * Exige sesion: son fotos de personas, no assets publicos. Como el Worker sirve
 * la SPA desde el mismo origen, la cookie viaja sola en las peticiones de
 * <img>, asi que no hace falta nada extra en el cliente.
 */

import { crearRuta } from './base';
import { noEncontrado } from '../lib/respuestas';

const rutas = crearRuta();

rutas.get('/*', async (c) => {
  const clave = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/api\/media\//, ''));

  // Sin recorridos de ruta ni claves fuera del prefijo esperado.
  if (!clave || clave.includes('..') || !clave.startsWith('perfiles/')) {
    throw noEncontrado('Archivo no encontrado');
  }

  if (!c.env.FOTOS) throw noEncontrado('Archivo no encontrado');
  const objeto = await c.env.FOTOS.get(clave);
  if (!objeto) throw noEncontrado('Archivo no encontrado');

  const cabeceras = new Headers();
  objeto.writeHttpMetadata(cabeceras);
  cabeceras.set('etag', objeto.httpEtag);
  // La clave lleva sufijo aleatorio y cambia con cada foto nueva: se puede
  // cachear de forma agresiva, pero solo en el navegador de quien la pidio.
  cabeceras.set('cache-control', 'private, max-age=31536000, immutable');

  return new Response(objeto.body, { headers: cabeceras });
});

export default rutas;
