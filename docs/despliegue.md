# Despliegue en Cloudflare

De cero a la app corriendo en `reto.conectamierp.com`, desde el repositorio
[tavopaz88-alt/diaunoapp](https://github.com/tavopaz88-alt/diaunoapp).

Cada paso dice qué esperar, para que sepas si algo salió mal antes de seguir.

**El orden importa.** Los pasos 1 a 4 crean los recursos y hay que hacerlos una
sola vez; recién después se conecta el repositorio, porque el despliegue falla si
la base de datos todavía no existe.

---

## 1. Entrar a Cloudflare

Desde la raíz del proyecto:

```bash
npx wrangler login
```

Abre el navegador y pide autorizar. Al terminar:

```bash
npx wrangler whoami
```

Debe mostrar tu cuenta y su Account ID.

---

## 2. Crear la base de datos

```bash
npx wrangler d1 create reto-metas
```

Devuelve algo así:

```
database_name = "reto-metas"
database_id = "a1b2c3d4-...."
```

**Copia ese `database_id` a `api/wrangler.toml`**, reemplazando
`REEMPLAZAR_CON_EL_ID_REAL`. Sin esto el despliegue falla.

Guarda el cambio en el repositorio, porque Cloudflare desplegará desde ahí:

```bash
git add api/wrangler.toml
git commit -m "Apuntar al D1 real"
git push
```

Aplica el esquema a la base:

```bash
npm run cf:migrar
```

Debe listar `0001_esquema_inicial.sql` con estado ✅.

---

## 3. Crear el bucket de fotos (opcional)

Las fotos de perfil se guardan en R2. **Si no quieres usar R2, salta este paso** y
borra el bloque `[[r2_buckets]]` de `api/wrangler.toml`: la app funciona igual y
solo se desactivan las fotos (los avatares muestran la inicial del nombre).

```bash
npx wrangler r2 bucket create reto-metas-fotos
```

Si tu cuenta aún no tiene R2 activado, el panel te lo pedirá una vez.

---

## 4. Ajustar las variables del reto

En `api/wrangler.toml`, bloque `[vars]`:

```toml
ZONA_HORARIA = "America/Guatemala"   # define de qué día se trata cada marca
APP_URL      = "https://reto.conectamierp.com"
EMAIL_FROM   = "Reto <reto@conectamierp.com>"
EMAIL_ACTIVO = "false"               # se pone en "true" en el paso 8
```

`ZONA_HORARIA` no es cosmético: decide cuándo cambia el día para todo el grupo. No
se deriva del teléfono de cada quien, a propósito.

Commitea y sube el cambio.

---

## 5. Conectar el repositorio

En el panel: **Workers & Pages → Create → Workers → Import a repository**, autoriza
GitHub y elige `tavopaz88-alt/diaunoapp`.

Configura la build así:

| Campo | Valor |
|---|---|
| Project name | `reto-metas` |
| Root directory | `/` (dejar vacío) |
| Build command | `npm run build` |
| Deploy command | `npm run cf:deploy` |
| Branch | `main` |

`npm run build` compila la SPA hacia `api/public`, y `npm run cf:deploy` publica el
Worker con esos archivos adentro. Los dos comandos están en el `package.json` de la
raíz, así que no hay nada más que configurar.

A partir de aquí, **cada push a `main` despliega solo**.

Si prefieres desplegar a mano desde tu máquina y no conectar el repositorio, el
equivalente es un único comando y puedes saltarte este paso:

```bash
npm run deploy
```

---

## 6. Cargar los secretos

Los secretos **no** van en el repositorio. Cárgalos una vez:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Con esa cadena:

```bash
cd api
npx wrangler secret put JWT_SECRET
npx wrangler secret put SETUP_TOKEN
```

- `JWT_SECRET` firma las sesiones. Si lo cambias después, todos tienen que volver
  a entrar.
- `SETUP_TOKEN` es de un solo uso real: la instalación solo corre con la base
  vacía, así que después de instalar deja de servir para nada.

También se pueden cargar desde el panel, en **Settings → Variables and Secrets**.

El de correo (`RESEND_API_KEY`) se agrega en el paso 8.

---

## 7. Poner el dominio

En el panel: **Workers & Pages → reto-metas → Settings → Domains & Routes → Add →
Custom domain**, y escribe `reto.conectamierp.com`.

Cloudflare crea el registro DNS solo, siempre que `conectamierp.com` ya esté en tu
cuenta. El certificado tarda unos minutos.

---

## 8. Correo (opcional, para la frase diaria)

Sin esto la app funciona completa; solo no salen correos.

1. Crea una cuenta en [resend.com](https://resend.com).
2. Verifica el dominio `conectamierp.com` (te da unos registros DNS que agregas en
   Cloudflare). Sin dominio verificado, Resend solo deja enviarte a ti mismo.
3. Genera una API key.
4. Cárgala:

```bash
cd api
npx wrangler secret put RESEND_API_KEY
```

En `api/wrangler.toml` pon `EMAIL_ACTIVO = "true"`, commitea y sube.

El Cron Trigger ya está configurado en `[triggers]`:

```toml
crons = ["0 12 * * *"]   # 12:00 UTC = 06:00 en Guatemala
```

Corre todos los días: manda la frase del día (solo si el administrador publicó una)
y, los lunes, además el resumen semanal.

Para probarlo sin esperar:

```bash
cd api
npx wrangler dev --test-scheduled
# y en otra terminal:
curl "http://localhost:8787/__scheduled?cron=0+12+*+*+*"
```

---

## 9. Instalar

Entra a `https://reto.conectamierp.com/instalar` y llena:

- el `SETUP_TOKEN` del paso 6
- tu nombre, correo y contraseña (quedas como administrador)
- nombre del reto, fecha de arranque y duración

La pantalla te devuelve el **código de invitación**. Compártelo: sin él nadie se
puede registrar. Después lo ves y lo cambias en *Administración*.

Comprueba que la instalación quedó cerrada:

```bash
curl https://reto.conectamierp.com/api/estado
# {"instalado":true,"reto":{...}}
```

Un segundo intento de `/instalar` debe responder «La aplicación ya está instalada».

---

## Operación diaria

```bash
git push                             # despliega solo, si conectaste el repo
cd api && npx wrangler tail          # ver logs en vivo
```

Consultar la base:

```bash
npx wrangler d1 execute reto-metas --remote --config api/wrangler.toml \
  --command "SELECT COUNT(*) FROM participaciones"
```

Respaldo:

```bash
npx wrangler d1 export reto-metas --remote --config api/wrangler.toml --output respaldo.sql
```

---

## Empezar de cero después de probar

Si estuviste probando con cuentas de mentira y querés que el reto real arranque
limpio, esto vacía **todos** los datos y deja la app como recién instalada:

```bash
npm run cf:vaciar-todo
```

Borra las 10 tablas (perfiles, retos, metas, registros, eventos, ánimos, frases y
tokens) y deja el esquema intacto, así que `/instalar` se vuelve a habilitar y
podés crear el administrador y el reto de nuevo.

**No hay vuelta atrás.** Si querés guardar lo que había antes:

```bash
npx wrangler d1 export reto-metas --remote --config api/wrangler.toml --output respaldo.sql
```

Lo que **no** borra:

- **Los secretos del Worker.** `JWT_SECRET` y `SETUP_TOKEN` siguen valiendo, así
  que para volver a instalar usás el mismo token de antes.
- **Las fotos de perfil en R2.** Quedan huérfanas, ocupando unos kilobytes. La
  forma limpia de barrerlas es rehacer el bucket:

```bash
npx wrangler r2 bucket delete reto-metas-fotos
```

```bash
npx wrangler r2 bucket create reto-metas-fotos
```

Para vaciar la base **local** de desarrollo, que es otra distinta:

```bash
npm run vaciar-local
```

> Si en vez de vaciar preferís sacar solo a algunas personas, no hace falta nada
> de esto: *Administración → Participantes → Sacar* los quita del reto y se
> llevan sus metas y registros con ellos, sin tocar al resto.

---

## Cosas que conviene saber

**El costo de la contraseña en el plan gratuito.** El hash usa PBKDF2 con 100.000
iteraciones, que es lo correcto para almacenar contraseñas pero consume CPU. El
plan gratuito de Workers da 10 ms de CPU por petición, y solo el registro y el
inicio de sesión llegan a ese punto (marcar el día no). Si ves errores de CPU al
entrar, tienes dos salidas: subir al plan Workers de pago (5 USD al mes, 30 s de
CPU) o bajar `ITERACIONES_ACTUALES` en
[`api/src/lib/password.ts`](../api/src/lib/password.ts). El formato del hash lleva
dentro sus propias iteraciones, así que cambiarlo **no invalida** las contraseñas
que ya existen: se verifican con su parámetro original y se rehacen al entrar.

**Límites de D1.** El plan gratuito da 5 GB y 5 millones de lecturas por día. Un
reto de 30 personas por 30 días son unas pocas miles de filas: no se acerca.

**Sin límite de intentos de login.** No hay bloqueo por fuerza bruta. Para un reto
por invitación es aceptable; si el registro se abriera, conviene poner Cloudflare
Rate Limiting sobre `/api/login` desde el panel, que no requiere tocar el código.

**Retos siguientes.** Al terminar los 30 días, *Administración* permite abrir otro
reto y arrastrar a los participantes. El anterior queda archivado e intacto para su
resumen.
