# Reto — app de seguimiento de metas

App para que una comunidad siga un reto de hábitos de 30 días. Cada quien define
sus metas, marca su avance diario, registra un resultado medible cada semana y al
final obtiene un resumen de lo que logró.

Lo que la separa de un tracker común: **no todas las metas se miden igual**. La
app se adapta al tipo de meta en lugar de forzar todo a un checkbox.

---

## Los cuatro tipos de meta

| Tipo | Qué pregunta cada semana | Cómo se ve | Métrica |
|---|---|---|---|
| `habito` | nada | cuadrícula + racha | días cumplidos / transcurridos |
| `acumulativo` | ¿cuántas unidades? | barra hacia el objetivo + barras por semana | acumulado / objetivo y ritmo |
| `medicion` | ¿cuál es el valor actual? | línea de trayectoria + línea de objetivo | cambio total y % del camino |
| `hito` | ¿qué lograste? (texto) | línea de tiempo de logros | número de logros y su lista |

**Todas** comparten la misma pregunta diaria: ¿cumpliste hoy? Eso separa la
**constancia** (diaria, comparable entre personas) del **resultado** (semanal,
propio de cada tipo).

---

## Stack

El spec original proponía Supabase. Este despliegue corre entero en Cloudflare:

| Pieza | Qué se usa |
|---|---|
| Base de datos | **D1** (SQLite serverless) |
| API | **Worker** con Hono |
| Autenticación | JWT propio, PBKDF2-SHA256 sobre WebCrypto, cookie `HttpOnly` |
| Fotos de perfil | **R2** (opcional: sin R2 todo lo demás funciona) |
| Frontend | **React + Vite**, servido por el mismo Worker |
| Correo | **Resend** desde un Cron Trigger |

Un solo Worker sirve la API en `/api` y la SPA en todo lo demás: mismo origen, sin
CORS y un solo despliegue.

> **Sobre la seguridad a nivel de fila.** D1 no tiene RLS. La intención del spec
> (que la seguridad no dependa del frontend) se cumple porque el navegador nunca
> habla con la base: todo pasa por el Worker. Las reglas de visibilidad viven
> concentradas en [`api/src/lib/visibilidad.ts`](api/src/lib/visibilidad.ts), que
> es el único lugar donde se decide qué ve una persona de otra.

---

## Estructura

```
api/                     Worker (API + servidor de la SPA)
  migrations/            esquema de D1
  src/
    index.ts             enrutado, middleware y cron
    tipos.ts             bindings y filas de la base
    lib/
      visibilidad.ts     ← reglas de acceso entre personas (el reemplazo de RLS)
      metricas.ts        constancia, rachas y resultado por tipo
      eventos.ts         muro de logros (solo eventos positivos)
      fechas.ts          día lógico del reto en su zona horaria
      password.ts        PBKDF2 sobre WebCrypto
      jwt.ts             firma de sesión
      correo.ts          plantillas y envío por Resend
      tareas.ts          frase diaria y resumen semanal
    rutas/               una por área de la API
web/
  src/
    paginas/             una por pantalla
    componentes/
      visualizaciones.tsx  ← una visualización por tipo de meta
      Cuadricula.tsx       cuadrícula de días
    lib/
      imagen.ts          resumen compartible, dibujado en canvas
docs/
  despliegue.md          puesta en marcha en Cloudflare, paso a paso
  decisiones.md          decisiones cerradas y desvíos respecto del spec
```

---

## Correr en local

```bash
npm install
```

Crea `api/.dev.vars` a partir de `api/.dev.vars.ejemplo` y aplica el esquema:

```bash
npm run db:local
```

Levanta todo (compila la SPA y arranca el Worker en `http://127.0.0.1:8787`):

```bash
npm run dev
```

Entra a `/instalar` y usa el `SETUP_TOKEN` de tu `.dev.vars` para crear el
administrador y el reto. La pantalla te devuelve el código de invitación.

Para trabajar el frontend con recarga en caliente, en otra terminal:

```bash
npm run dev:web
```

Eso abre Vite en `http://localhost:5173` y manda `/api` al Worker.

---

## Comprobaciones

```bash
npm run typecheck
```

---

## Despliegue

Ver [docs/despliegue.md](docs/despliegue.md).
