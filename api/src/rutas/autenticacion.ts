/** Registro, inicio de sesion, recuperacion de contrasena e instalacion inicial. */

import { crearRuta, datosDelReto, perfilPublico } from './base';
import { esConexionSegura, perfilDe } from '../lib/autenticacion';
import { cookieBorrada, cookieSesion, firmarSesion } from '../lib/jwt';
import { hashearClave, necesitaRehash, verificarClave } from '../lib/password';
import { nuevoCodigoAcceso, nuevoId, nuevoToken, sha256Hex } from '../lib/ids';
import { correoRecuperacion, enviarCorreo } from '../lib/correo';
import { eventoDeIngreso } from '../lib/eventos';
import { participacionDe, perfilPorEmail, retoActivo, retoPorCodigo } from '../lib/consultas';
import { esFecha, fechaFinReto, hoyEn } from '../lib/fechas';
import {
  claveRequerida,
  conflicto,
  cuerpoJson,
  emailRequerido,
  malaPeticion,
  noAutorizado,
  textoRequerido,
} from '../lib/respuestas';

const rutas = crearRuta();

/** Estado publico: le dice a la SPA si ya hay instalacion y reto. */
rutas.get('/estado', async (c) => {
  const cuenta = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>();
  const reto = await retoActivo(c.env);

  return c.json({
    instalado: (cuenta?.n ?? 0) > 0,
    reto: reto
      ? {
          nombre: reto.nombre,
          fecha_inicio: reto.fecha_inicio,
          fecha_fin: fechaFinReto(reto),
          duracion_dias: reto.duracion_dias,
        }
      : null,
  });
});

/**
 * Instalacion: crea el primer administrador y el reto.
 * Solo funciona con la base vacia y con el SETUP_TOKEN correcto, asi que deja
 * de estar disponible despues del primer uso.
 */
rutas.post('/setup', async (c) => {
  const datos = await cuerpoJson(c.req.raw);

  const cuenta = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM profiles').first<{ n: number }>();
  if ((cuenta?.n ?? 0) > 0) throw conflicto('La aplicación ya está instalada');

  const token = textoRequerido(datos, 'token');
  if (!c.env.SETUP_TOKEN || token !== c.env.SETUP_TOKEN) {
    throw noAutorizado('Token de instalación invalido');
  }

  const nombre = textoRequerido(datos, 'nombre', { max: 80 });
  const email = emailRequerido(datos);
  const clave = claveRequerida(datos);
  const nombreReto = textoRequerido(datos, 'reto_nombre', { max: 120 });
  const fechaInicio = textoRequerido(datos, 'fecha_inicio');
  if (!esFecha(fechaInicio)) throw malaPeticion('fecha_inicio debe ser YYYY-MM-DD');

  const duracion = Number(datos.duracion_dias ?? 30);
  if (!Number.isInteger(duracion) || duracion < 7 || duracion > 365) {
    throw malaPeticion('La duración debe estar entre 7 y 365 días');
  }

  const hoy = hoyEn(c.env.ZONA_HORARIA);
  const userId = nuevoId();
  const retoId = nuevoId();
  const codigo = nuevoCodigoAcceso();

  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO profiles (id, email, password_hash, nombre, es_admin) VALUES (?, ?, ?, ?, 1)',
    ).bind(userId, email, await hashearClave(clave), nombre),
    c.env.DB.prepare(
      'INSERT INTO retos (id, nombre, fecha_inicio, duracion_dias, codigo_acceso, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(retoId, nombreReto, fechaInicio, duracion, codigo, userId),
    c.env.DB.prepare(
      'INSERT INTO participaciones (id, reto_id, user_id, fecha_ingreso) VALUES (?, ?, ?, ?)',
    ).bind(nuevoId(), retoId, userId, hoy),
  ]);

  await eventoDeIngreso(c.env, retoId, userId);

  const sesion = await firmarSesion({ sub: userId, pv: 1, adm: true }, c.env.JWT_SECRET);
  c.header('Set-Cookie', cookieSesion(sesion, esConexionSegura(c.req.raw)));
  return c.json({ ok: true, codigo_acceso: codigo }, 201);
});

/** Registro por invitacion (decision 11.3): hace falta el codigo del reto. */
rutas.post('/registro', async (c) => {
  const datos = await cuerpoJson(c.req.raw);
  const nombre = textoRequerido(datos, 'nombre', { max: 80 });
  const email = emailRequerido(datos);
  const clave = claveRequerida(datos);
  const codigo = textoRequerido(datos, 'codigo', { max: 32 });

  const reto = await retoPorCodigo(c.env, codigo);
  if (!reto) throw malaPeticion('El código de acceso no es válido');

  if (await perfilPorEmail(c.env, email)) {
    throw conflicto('Ya existe una cuenta con ese correo');
  }

  const hoy = hoyEn(c.env.ZONA_HORARIA);
  const userId = nuevoId();

  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO profiles (id, email, password_hash, nombre) VALUES (?, ?, ?, ?)').bind(
      userId,
      email,
      await hashearClave(clave),
      nombre,
    ),
    c.env.DB.prepare(
      'INSERT INTO participaciones (id, reto_id, user_id, fecha_ingreso) VALUES (?, ?, ?, ?)',
    ).bind(nuevoId(), reto.id, userId, hoy),
  ]);

  await eventoDeIngreso(c.env, reto.id, userId);

  const sesion = await firmarSesion({ sub: userId, pv: 1, adm: false }, c.env.JWT_SECRET);
  c.header('Set-Cookie', cookieSesion(sesion, esConexionSegura(c.req.raw)));
  return c.json({ ok: true }, 201);
});

rutas.post('/login', async (c) => {
  const datos = await cuerpoJson(c.req.raw);
  const email = emailRequerido(datos);
  const clave = typeof datos.password === 'string' ? datos.password : '';

  const perfil = await perfilPorEmail(c.env, email);
  // Mismo mensaje exista o no la cuenta: no confirma que correos estan registrados.
  const generico = noAutorizado('Correo o contraseña incorrectos');

  if (!perfil) {
    // Trabajo comparable al de un login real, para no delatar por tiempo de respuesta.
    await hashearClave(clave || 'sin-clave');
    throw generico;
  }
  if (!(await verificarClave(clave, perfil.password_hash))) throw generico;

  if (necesitaRehash(perfil.password_hash)) {
    await c.env.DB.prepare('UPDATE profiles SET password_hash = ? WHERE id = ?')
      .bind(await hashearClave(clave), perfil.id)
      .run();
  }

  const sesion = await firmarSesion(
    { sub: perfil.id, pv: perfil.password_version, adm: perfil.es_admin === 1 },
    c.env.JWT_SECRET,
  );
  c.header('Set-Cookie', cookieSesion(sesion, esConexionSegura(c.req.raw)));
  return c.json({ ok: true });
});

rutas.post('/salir', (c) => {
  c.header('Set-Cookie', cookieBorrada(esConexionSegura(c.req.raw)));
  return c.json({ ok: true });
});

/** Quien soy: perfil, reto y si ya estoy inscrito. */
rutas.get('/yo', async (c) => {
  const perfil = await perfilDe(c.req.raw, c.env);
  const reto = await retoActivo(c.env);
  const participacion = reto ? await participacionDe(c.env, reto.id, perfil.id) : null;

  return c.json({
    perfil: perfilPublico(perfil),
    reto: reto ? datosDelReto(reto) : null,
    inscrito: Boolean(participacion),
    aparece_en_ranking: participacion ? participacion.aparece_en_ranking === 1 : true,
    hoy: hoyEn(c.env.ZONA_HORARIA),
  });
});

/** Solicitud de recuperacion. Responde igual exista o no la cuenta. */
rutas.post('/recuperar', async (c) => {
  const datos = await cuerpoJson(c.req.raw);
  const email = emailRequerido(datos);
  const perfil = await perfilPorEmail(c.env, email);

  if (perfil) {
    const token = nuevoToken();
    const expira = new Date(Date.now() + 3_600_000).toISOString();

    await c.env.DB.prepare(
      'INSERT INTO tokens_recuperacion (token_hash, user_id, expira_en) VALUES (?, ?, ?)',
    )
      .bind(await sha256Hex(token), perfil.id, expira)
      .run();

    const url = c.env.APP_URL.replace(/\/$/, '') + '/restablecer?token=' + token;
    await enviarCorreo(c.env, {
      para: perfil.email,
      ...correoRecuperacion(c.env, perfil.nombre, url),
    });
  }

  return c.json({ ok: true, mensaje: 'Si el correo existe, te llegará un enlace' });
});

rutas.post('/restablecer', async (c) => {
  const datos = await cuerpoJson(c.req.raw);
  const token = textoRequerido(datos, 'token', { max: 128 });
  const clave = claveRequerida(datos);
  const hash = await sha256Hex(token);

  const fila = await c.env.DB.prepare(
    'SELECT * FROM tokens_recuperacion WHERE token_hash = ? AND usado = 0',
  )
    .bind(hash)
    .first<{ user_id: string; expira_en: string }>();

  if (!fila || fila.expira_en < new Date().toISOString()) {
    throw malaPeticion('El enlace ya venció o no es válido. Pedí uno nuevo.');
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE profiles SET password_hash = ?, password_version = password_version + 1 WHERE id = ?',
    ).bind(await hashearClave(clave), fila.user_id),
    // Cualquier otro enlace pendiente de esa cuenta deja de servir.
    c.env.DB.prepare('UPDATE tokens_recuperacion SET usado = 1 WHERE user_id = ?').bind(fila.user_id),
  ]);

  return c.json({ ok: true });
});

export default rutas;
