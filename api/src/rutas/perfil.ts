/** Perfil propio: nombre, foto, contrasena, privacidad, exportacion y baja. */

import { crearRuta, perfilPublico } from './base';
import { esConexionSegura } from '../lib/autenticacion';
import { cookieBorrada, cookieSesion, firmarSesion } from '../lib/jwt';
import { hashearClave, verificarClave } from '../lib/password';
import { nuevoId } from '../lib/ids';
import { eventoDeIngreso } from '../lib/eventos';
import { hoyEn } from '../lib/fechas';
import { participacionDe, retoActivo, retoPorCodigo } from '../lib/consultas';
import {
  booleano,
  ErrorApi,
  claveRequerida,
  cuerpoJson,
  malaPeticion,
  noAutorizado,
  textoRequerido,
} from '../lib/respuestas';

const rutas = crearRuta();

/** Limite de la foto ya recortada por el cliente. */
const MAX_BYTES_FOTO = 600 * 1024;
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

rutas.get('/', (c) => c.json({ perfil: perfilPublico(c.get('perfil')) }));

rutas.patch('/', async (c) => {
  const perfil = c.get('perfil');
  const datos = await cuerpoJson(c.req.raw);
  const nombre = textoRequerido(datos, 'nombre', { max: 80 });

  await c.env.DB.prepare('UPDATE profiles SET nombre = ? WHERE id = ?').bind(nombre, perfil.id).run();
  return c.json({ ok: true, nombre });
});

/** Cambio de contrasena. Sube password_version y cierra las demas sesiones. */
rutas.post('/clave', async (c) => {
  const perfil = c.get('perfil');
  const datos = await cuerpoJson(c.req.raw);
  const actual = typeof datos.actual === 'string' ? datos.actual : '';
  const nueva = claveRequerida(datos, 'nueva');

  if (!(await verificarClave(actual, perfil.password_hash))) {
    throw noAutorizado('La contraseña actual no coincide');
  }

  await c.env.DB.prepare(
    'UPDATE profiles SET password_hash = ?, password_version = password_version + 1 WHERE id = ?',
  )
    .bind(await hashearClave(nueva), perfil.id)
    .run();

  // Se renueva la cookie de esta sesion para no expulsar a quien hizo el cambio.
  const sesion = await firmarSesion(
    { sub: perfil.id, pv: perfil.password_version + 1, adm: perfil.es_admin === 1 },
    c.env.JWT_SECRET,
  );
  c.header('Set-Cookie', cookieSesion(sesion, esConexionSegura(c.req.raw)));
  return c.json({ ok: true });
});

/**
 * Foto de perfil. El cliente manda la imagen ya recortada en cuadrado; aqui
 * solo se valida tipo y tamano y se guarda en R2.
 */
rutas.post('/foto', async (c) => {
  const perfil = c.get('perfil');
  if (!c.env.FOTOS) throw new ErrorApi(503, 'Las fotos de perfil no están configuradas en este despliegue');
  const tipo = (c.req.header('content-type') ?? '').split(';')[0]?.trim() ?? '';

  if (!TIPOS_IMAGEN.includes(tipo)) {
    throw malaPeticion('La foto debe ser JPEG, PNG o WebP');
  }

  const cuerpo = await c.req.raw.arrayBuffer();
  if (cuerpo.byteLength === 0) throw malaPeticion('La foto llegó vacía');
  if (cuerpo.byteLength > MAX_BYTES_FOTO) {
    throw malaPeticion('La foto pasa de 600 KB. Recórtala o bajale calidad.');
  }

  const extension = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  const clave = `perfiles/${perfil.id}-${nuevoId().slice(0, 8)}.${extension}`;

  await c.env.FOTOS.put(clave, cuerpo, {
    httpMetadata: { contentType: tipo, cacheControl: 'public, max-age=31536000, immutable' },
  });

  const anterior = perfil.foto_url;
  const url = `/api/media/${clave}`;
  await c.env.DB.prepare('UPDATE profiles SET foto_url = ? WHERE id = ?').bind(url, perfil.id).run();

  // La anterior deja de servir a nadie: se borra para no acumular objetos.
  if (anterior?.startsWith('/api/media/')) {
    await c.env.FOTOS?.delete(anterior.replace('/api/media/', '')).catch(() => undefined);
  }

  return c.json({ ok: true, foto_url: url });
});

rutas.delete('/foto', async (c) => {
  const perfil = c.get('perfil');
  if (perfil.foto_url?.startsWith('/api/media/')) {
    await c.env.FOTOS?.delete(perfil.foto_url.replace('/api/media/', '')).catch(() => undefined);
  }
  await c.env.DB.prepare('UPDATE profiles SET foto_url = NULL WHERE id = ?').bind(perfil.id).run();
  return c.json({ ok: true });
});

/**
 * Unirse a un reto con el codigo de invitacion, ya teniendo cuenta.
 * Hace falta cuando se abre un reto nuevo (decision 11.4) sin arrastrar a los
 * participantes del anterior.
 */
rutas.post('/unirse', async (c) => {
  const perfil = c.get('perfil');
  const datos = await cuerpoJson(c.req.raw);
  const codigo = textoRequerido(datos, 'codigo', { max: 32 });

  const reto = await retoPorCodigo(c.env, codigo);
  if (!reto) throw malaPeticion('El código de acceso no es válido');

  if (await participacionDe(c.env, reto.id, perfil.id)) {
    return c.json({ ok: true, ya_estaba: true });
  }

  await c.env.DB.prepare(
    'INSERT INTO participaciones (id, reto_id, user_id, fecha_ingreso) VALUES (?, ?, ?, ?)',
  )
    .bind(nuevoId(), reto.id, perfil.id, hoyEn(c.env.ZONA_HORARIA))
    .run();

  await eventoDeIngreso(c.env, reto.id, perfil.id);
  return c.json({ ok: true }, 201);
});

/** Decision 11.5: se puede participar sin aparecer en el ranking. */
rutas.patch('/ranking', async (c) => {
  const perfil = c.get('perfil');
  const datos = await cuerpoJson(c.req.raw);
  const aparece = booleano(datos, 'aparece_en_ranking', true);

  const reto = await retoActivo(c.env);
  if (!reto) throw malaPeticion('No hay un reto activo');

  await c.env.DB.prepare(
    'UPDATE participaciones SET aparece_en_ranking = ? WHERE reto_id = ? AND user_id = ?',
  )
    .bind(aparece ? 1 : 0, reto.id, perfil.id)
    .run();

  return c.json({ ok: true, aparece_en_ranking: aparece });
});

/** Criterio 12: los datos son del usuario y tiene que poder llevarselos. */
rutas.get('/exportar', async (c) => {
  const perfil = c.get('perfil');

  const metas = await c.env.DB.prepare(
    'SELECT * FROM metas WHERE user_id = ? ORDER BY created_at',
  )
    .bind(perfil.id)
    .all();

  const diarios = await c.env.DB.prepare(
    'SELECT d.* FROM registros_diarios d JOIN metas m ON m.id = d.meta_id WHERE m.user_id = ? ORDER BY d.fecha',
  )
    .bind(perfil.id)
    .all();

  const semanales = await c.env.DB.prepare(
    'SELECT s.* FROM registros_semanales s JOIN metas m ON m.id = s.meta_id WHERE m.user_id = ? ORDER BY s.semana_inicio',
  )
    .bind(perfil.id)
    .all();

  const participaciones = await c.env.DB.prepare(
    'SELECT * FROM participaciones WHERE user_id = ?',
  )
    .bind(perfil.id)
    .all();

  const exportacion = {
    exportado_en: new Date().toISOString(),
    perfil: perfilPublico(perfil),
    participaciones: participaciones.results ?? [],
    metas: metas.results ?? [],
    registros_diarios: diarios.results ?? [],
    registros_semanales: semanales.results ?? [],
  };

  return new Response(JSON.stringify(exportacion, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mis-datos-del-reto.json"',
    },
  });
});

/** Baja de cuenta. Pide la contrasena porque no tiene vuelta atras. */
rutas.delete('/', async (c) => {
  const perfil = c.get('perfil');
  const datos = await cuerpoJson(c.req.raw);
  const clave = typeof datos.password === 'string' ? datos.password : '';

  if (!(await verificarClave(clave, perfil.password_hash))) {
    throw noAutorizado('La contraseña no coincide');
  }

  if (perfil.foto_url?.startsWith('/api/media/')) {
    await c.env.FOTOS?.delete(perfil.foto_url.replace('/api/media/', '')).catch(() => undefined);
  }

  // Las claves foraneas van con ON DELETE CASCADE: metas, registros, eventos y
  // animos se van con el perfil.
  await c.env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(perfil.id).run();

  c.header('Set-Cookie', cookieBorrada(esConexionSegura(c.req.raw)));
  return c.json({ ok: true });
});

export default rutas;
