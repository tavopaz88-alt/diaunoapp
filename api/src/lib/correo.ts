/**
 * Envio de correo por Resend.
 *
 * Si EMAIL_ACTIVO no es "true" o falta la API key, el envio se omite y se deja
 * traza en el log. Es a proposito: la app tiene que funcionar completa sin
 * correo configurado, y en desarrollo nadie quiere mandar correos de verdad.
 */

import type { Env } from '../tipos';

export interface Mensaje {
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export function correoActivo(env: Env): boolean {
  return env.EMAIL_ACTIVO === 'true' && Boolean(env.RESEND_API_KEY);
}

export async function enviarCorreo(env: Env, mensaje: Mensaje): Promise<boolean> {
  if (!correoActivo(env)) {
    console.log(`[correo omitido] ${mensaje.para} :: ${mensaje.asunto}`);
    return false;
  }

  try {
    const respuesta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [mensaje.para],
        subject: mensaje.asunto,
        html: mensaje.html,
        text: mensaje.texto,
      }),
    });

    if (!respuesta.ok) {
      console.error(`[correo] fallo ${respuesta.status}: ${await respuesta.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[correo] error de red', error);
    return false;
  }
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plantilla base: tabla simple, sin CSS externo, legible en cualquier cliente. */
function plantilla(titulo: string, cuerpo: string, env: Env, accion?: { texto: string; url: string }): string {
  const boton = accion
    ? `<tr><td style="padding:8px 0 24px">
         <a href="${escapar(accion.url)}"
            style="background:#1f7a5a;color:#fff;text-decoration:none;padding:14px 28px;
                   border-radius:10px;display:inline-block;font-weight:600">${escapar(accion.texto)}</a>
       </td></tr>`
    : '';

  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f4f2;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
          <tr><td style="font-size:20px;font-weight:700;padding-bottom:16px">${escapar(titulo)}</td></tr>
          <tr><td style="font-size:16px;line-height:1.6;padding-bottom:16px">${cuerpo}</td></tr>
          ${boton}
          <tr><td style="font-size:13px;color:#77776f;border-top:1px solid #e8e8e4;padding-top:16px">
            <a href="${escapar(env.APP_URL)}" style="color:#77776f">${escapar(env.APP_URL)}</a>
          </td></tr>
        </table>
      </td></tr>
    </table></body></html>`;
}

export function correoRecuperacion(env: Env, nombre: string, url: string): Omit<Mensaje, 'para'> {
  const cuerpo = `Hola ${escapar(nombre)}, recibimos una solicitud para restablecer tu contrasena.
    El enlace vence en una hora. Si no fuiste vos, podes ignorar este correo: tu clave no cambia.`;
  return {
    asunto: 'Restablecer tu contraseña',
    html: plantilla('Restablecer tu contraseña', cuerpo, env, { texto: 'Cambiar contraseña', url }),
    texto: `Hola ${nombre}. Para restablecer tu contrasena entra a: ${url}\nEl enlace vence en una hora.`,
  };
}

export function correoFraseDelDia(
  env: Env,
  datos: { nombre: string; frase: string; dia: number; duracion: number; racha: number },
): Omit<Mensaje, 'para'> {
  const racha =
    datos.racha > 1
      ? `<p style="margin:16px 0 0;color:#77776f">Llevas <strong>${datos.racha} días seguidos</strong>.</p>`
      : '';
  const cuerpo = `<p style="margin:0;color:#77776f">Día ${datos.dia} de ${datos.duracion}</p>
    <p style="margin:12px 0 0;font-size:18px;font-style:italic">"${escapar(datos.frase)}"</p>${racha}`;

  return {
    asunto: `Día ${datos.dia}: tu frase de hoy`,
    html: plantilla(`Buenos dias, ${datos.nombre}`, cuerpo, env, {
      texto: 'Marcar mi día',
      url: env.APP_URL,
    }),
    texto: `Día ${datos.dia} de ${datos.duracion}\n\n"${datos.frase}"\n\nMarca tu dia: ${env.APP_URL}`,
  };
}

export function correoResumenSemanal(
  env: Env,
  datos: { nombre: string; porcentaje: number; racha: number; diasGrupo: number; pendientes: number },
): Omit<Mensaje, 'para'> {
  const pendientes =
    datos.pendientes > 0
      ? `<p style="margin:16px 0 0">Tenes <strong>${datos.pendientes}</strong> registro(s) semanal(es) por llenar.</p>`
      : '';
  const cuerpo = `<p style="margin:0">Tu constancia va en <strong>${datos.porcentaje}%</strong>
    y llevas una racha de <strong>${datos.racha}</strong> día(s).</p>
    <p style="margin:16px 0 0;color:#77776f">Entre todo el grupo suman
    <strong>${datos.diasGrupo}</strong> días cumplidos.</p>${pendientes}`;

  return {
    asunto: 'Tu semana en el reto',
    html: plantilla(`Como te fue, ${datos.nombre}`, cuerpo, env, {
      texto: 'Ver mi avance',
      url: env.APP_URL,
    }),
    texto: `Constancia: ${datos.porcentaje}% | Racha: ${datos.racha} días | Grupo: ${datos.diasGrupo} dias cumplidos\n${env.APP_URL}`,
  };
}
