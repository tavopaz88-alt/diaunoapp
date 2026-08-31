/**
 * Punto de entrada del Worker.
 *
 * El mismo Worker sirve la API bajo /api y la SPA compilada en todo lo demas.
 * Un solo origen: sin CORS, sin token en localStorage y un unico despliegue.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Enlaces } from './rutas/base';
import rutasAutenticacion from './rutas/autenticacion';
import rutasPerfil from './rutas/perfil';
import rutasMetas from './rutas/metas';
import rutasRegistros from './rutas/registros';
import rutasComunidad from './rutas/comunidad';
import rutasAdmin from './rutas/admin';
import rutasResumen from './rutas/resumen';
import rutasMedia from './rutas/media';
import { contextoDe, perfilDe } from './lib/autenticacion';
import { ErrorApi } from './lib/respuestas';
import { enviarFraseDelDia, enviarResumenSemanal, limpiarTokens } from './lib/tareas';
import type { Env } from './tipos';

const app = new Hono<Enlaces>();
const api = new Hono<Enlaces>();

// ---------------------------------------------------------------- seguridad

/** Exige sesion valida y deja el perfil en el contexto. */
const conSesion: MiddlewareHandler<Enlaces> = async (c, next) => {
  c.set('perfil', await perfilDe(c.req.raw, c.env));
  await next();
};

/** Ademas exige reto activo e inscripcion. */
const conReto: MiddlewareHandler<Enlaces> = async (c, next) => {
  c.set('ctx', await contextoDe(c.get('perfil'), c.env));
  await next();
};

/**
 * Defensa CSRF sencilla: la cookie es SameSite=Lax, que ya bloquea el envio en
 * peticiones cross-site que mutan datos. Exigir JSON en los metodos de
 * escritura cierra el hueco de los formularios HTML, que pueden cruzar origen
 * pero no pueden mandar application/json.
 */
api.use('*', async (c, next) => {
  const metodo = c.req.method;
  if (metodo !== 'GET' && metodo !== 'HEAD') {
    const tipo = c.req.header('content-type') ?? '';
    const esJson = tipo.includes('application/json');
    const esImagen = tipo.startsWith('image/');
    if (!esJson && !esImagen) {
      return c.json({ error: 'Las peticiones de escritura deben ser JSON' }, 415);
    }
  }
  await next();
});

// -------------------------------------------------------------- rutas publicas
// /api/estado /api/setup /api/registro /api/login /api/salir /api/yo
// /api/recuperar /api/restablecer
api.route('/', rutasAutenticacion);

// ------------------------------------------------------- requieren sesion
api.use('/perfil', conSesion);
api.use('/perfil/*', conSesion);
api.use('/media/*', conSesion);

api.route('/perfil', rutasPerfil);
api.route('/media', rutasMedia);

// --------------------------------------------- requieren sesion + reto activo
for (const patron of [
  '/metas',
  '/metas/*',
  '/hoy',
  '/dias',
  '/semanas',
  '/comunidad',
  '/comunidad/*',
  '/animos',
  '/admin',
  '/admin/*',
  '/resumen',
]) {
  api.use(patron, conSesion, conReto);
}

api.route('/metas', rutasMetas);
api.route('/', rutasRegistros); // /hoy /dias /semanas
api.route('/comunidad', rutasComunidad);
api.route('/', rutasComunidad); // expone /animos
api.route('/admin', rutasAdmin);
api.route('/resumen', rutasResumen);

/** Nada mas bajo /api: 404 en JSON, no el index.html de la SPA. */
api.all('*', (c) => c.json({ error: 'Ruta no encontrada' }, 404));

app.route('/api', api);

// ------------------------------------------------------------------- la SPA

app.all('*', async (c) => {
  const respuesta = await c.env.ASSETS.fetch(c.req.raw);
  if (respuesta.status !== 404) return respuesta;

  const url = new URL(c.req.url);

  /*
   * El index solo se devuelve para NAVEGACIONES. Un archivo que no existe tiene
   * que dar 404 de verdad.
   *
   * Sin esta distinción, pedir un /assets/index-abc.js inexistente devolvía el
   * index.html con estado 200 y tipo text/html. El navegador lo aceptaba como
   * módulo, fallaba al ejecutarlo, y la pantalla quedaba en blanco con un error
   * que no señalaba a ninguna parte. Un 404 dice exactamente qué falta.
   */
  const pideArchivo = /\.[a-z0-9]+$/i.test(url.pathname);
  const esNavegacion = (c.req.header('accept') ?? '').includes('text/html');
  if (pideArchivo || !esNavegacion) return respuesta;

  // Rutas del cliente (/comunidad, /metas/xxx...) devuelven el index.
  url.pathname = '/';
  return c.env.ASSETS.fetch(new Request(url.toString(), { headers: c.req.raw.headers }));
});

// ------------------------------------------------------------------- errores

app.onError((error, c) => {
  if (error instanceof ErrorApi) {
    return c.json({ error: error.message }, error.estado as 400);
  }

  // Un error inesperado no debe filtrar detalles internos al cliente.
  console.error('[error no controlado]', error);
  return c.json({ error: 'Algo salió mal. Intenta de nuevo.' }, 500);
});

// ------------------------------------------------------------ tareas del cron

export default {
  fetch: app.fetch,

  async scheduled(evento: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await limpiarTokens(env);

        const resultado = await enviarFraseDelDia(env);
        console.log('[cron]', JSON.stringify(resultado));

        // Los lunes se agrega el resumen de la semana que cerro ayer.
        const dia = new Date(evento.scheduledTime).getUTCDay();
        if (dia === 1) {
          console.log('[cron]', JSON.stringify(await enviarResumenSemanal(env)));
        }
      })(),
    );
  },
};
