# Decisiones

Qué se cerró, por qué, y en qué se apartó la implementación del spec.

---

## 1. Las decisiones abiertas (sección 11 del spec)

Se cerraron con las sugerencias del propio spec.

| # | Decisión | Cómo quedó | Dónde vive |
|---|---|---|---|
| 1 | ¿Qué día cierra la semana? | **Domingo.** La semana corre de lunes a domingo; `semana_inicio` guarda el lunes. La primera y la última se recortan al rango real del reto. | `api/src/lib/fechas.ts` |
| 2 | ¿Se puede marcar un día pasado? | **Sí, hasta 2 días atrás.** Nunca hacia adelante, ni antes del ingreso al reto. | `DIAS_RETROACTIVOS` en `api/src/rutas/registros.ts` |
| 3 | ¿Registro abierto o por invitación? | **Por invitación**, con un código de 8 caracteres sin letras ambiguas. El administrador lo puede regenerar, lo que corta el acceso a quien ya lo tenía. | `retos.codigo_acceso` |
| 4 | ¿Qué pasa al terminar? | **Se archiva y se abre otro.** La tabla `retos` es multi-reto desde el inicio; v1 mantiene uno activo. Al crear el siguiente se puede arrastrar a los participantes para no obligarlos a registrarse de nuevo. | `POST /api/admin/retos` |
| 5 | ¿Se puede desactivar el ranking? | **Sí**, por persona. Sigue participando y el muro sigue celebrando sus logros; solo no aparece en el top ni recibe posición. | `participaciones.aparece_en_ranking` |

---

## 2. Cambio de stack: de Supabase a Cloudflare

El spec proponía Supabase. Como el entorno disponible es Cloudflare, todo se movió
ahí. La traducción pieza por pieza está en el [README](../README.md).

**Lo único que no tiene equivalente directo es RLS.** D1 no tiene políticas a nivel
de fila. El spec pedía explícitamente que la seguridad no dependiera del frontend,
y esa intención se cumple así:

- El navegador nunca habla con la base. Solo existe la API del Worker.
- Todas las decisiones de «qué ve una persona de otra» están en un solo módulo,
  `api/src/lib/visibilidad.ts`, para que sean auditables de una sentada.
- Ninguna ruta replica esa lógica: si necesita decidir, llama ahí.

El resultado es equivalente en garantías y más fácil de revisar que un conjunto de
políticas repartidas. Lo que se pierde es la red de seguridad de la base: si alguien
agrega una ruta y olvida filtrar, no hay una segunda barrera. Por eso el módulo
lleva la advertencia arriba y las rutas no arman filtros propios.

---

## 3. Decisiones de producto que el spec no cerraba

### El ranking se oculta entero en grupos chicos

El spec dice «nadie ve quién va último» y publica un top 5. Con seis participantes,
publicar cinco delata al sexto por descarte.

La API no publica ranking mientras haya menos de **7** participantes
(`TOPE_VISIBLE + 2`, para que queden al menos dos posiciones sin identificar). Por
debajo de eso solo salen el impulso del grupo y la posición propia. Es la misma
regla del spec llevada al caso chico.

*(`MINIMO_PARA_RANKING` en `api/src/rutas/comunidad.ts`.)*

### El administrador no ve más que cualquiera

Un administrador **no** puede ver metas privadas, ni valores de metas ajenas, ni la
tabla completa de constancia. La lista de participantes trae nombre, correo, fecha
de ingreso y rol; no trae constancia ni orden por avance.

El razonamiento es el de la sección 4 del spec: si el administrador pudiera ver un
peso corporal, la gente registraría datos falsos o no crearía esa meta, y eso vacía
el producto. Saber quién va último tampoco le hace falta para gestionar.

### Bajar la visibilidad alcanza a lo ya publicado

Un evento del muro sigue siendo público después de que su meta cambia de
visibilidad. Al bajarla, los eventos se retiran:

- a `privada`: se borran todos los eventos de esa meta;
- a `titulo`: se borran los `logro` (llevan el texto semanal) y se conserva
  «completó su meta X», que solo lleva el título.

Sin esto, poner una meta en privado no servía para nada retroactivamente.

### Publicaciones: ordenadas por actividad, no por popularidad

El muro de logros lo escribe la app sola. Faltaba que la gente pudiera contar cómo
va con sus palabras, así que se agregaron **publicaciones y comentarios**, en una
pestaña aparte del muro. Mezclarlos volvería confuso qué dijo una persona y qué
dedujo el sistema.

El pedido original era ordenar el feed **por interacciones**. No se hizo así, y la
razón es la misma que sostiene el resto del producto: en un grupo de treinta, un
feed ordenado por popularidad reconstruye exactamente lo que el ranking evita. La
publicación con cero reacciones se hunde al fondo, y su autor lo ve. Es la misma
persona que el corte en cinco protege, expuesta por otra puerta.

Se ordena por **última actividad**: una publicación sube cuando recibe un
comentario. Da el efecto útil que se buscaba —las conversaciones vivas quedan
arriba— sin que el criterio sea cuánta atención recibió nadie.

Moderación: cada quien borra lo suyo y un administrador puede borrar cualquier
publicación o comentario. Es el mínimo que hace responsable el texto libre; sin
eso, un mensaje desubicado no tiene remedio dentro de la app.

Una publicación puede colgar de una meta propia, pero **nunca de una meta
`privada`**: el título es justo lo que su dueño decidió reservar. La API lo
rechaza, no solo el formulario.

### El index.html solo se sirve en navegaciones

El respaldo de SPA devolvía `index.html` para cualquier ruta que no existiera,
incluidos los archivos estáticos. Un `/assets/index-abc.js` inexistente respondía
HTML con estado 200; el navegador lo aceptaba como módulo, fallaba al ejecutarlo y
la pantalla quedaba en blanco sin un error que señalara la causa.

Ahora el index solo sale si la petición es una navegación (acepta `text/html` y no
pide un archivo con extensión). Cualquier otra cosa que falte da 404 de verdad, que
es lo que permite diagnosticarla.

### El resumen compartible avisa antes de exponer

La imagen del resumen incluye las metas privadas: es el resumen propio y su dueño
decide compartirlo. Pero «privada» es una decisión deliberada, así que la pantalla
avisa antes de generarla. Se respeta la autonomía sin la sorpresa.

### La racha no se cae por la mañana

Si hoy todavía no se marca, la racha se cuenta desde ayer. De lo contrario se
«rompería» cada madrugada hasta que la persona abriera la app, que es exactamente el
tipo de caída que la sección 12 pide no mostrar.

### Marcar el día va antes que todo lo demás

El spec lista la pantalla principal en un orden y luego pide que marcar el día tome
menos de diez segundos. Manda el criterio: las casillas van arriba, antes de la
frase, los ánimos y la cuadrícula. Además el toque es optimista, la casilla responde
antes que la red, y si falla se revierte.

### Detalle diario opcional, sin tocar la constancia

El spec hizo la capa diaria universal —la misma pregunta sí/no para todos los
tipos— por dos razones: se llena en segundos, y es lo único comparable entre
personas. Las dos siguen en pie.

Encima de eso se agregó detalle **opcional**: cuánto hiciste (solo acumulativas)
y qué hiciste (cualquier tipo). Vive detrás de un botón aparte, así que el toque
para marcar el día sigue siendo un toque sobre casi toda la fila.

**El detalle no entra en la constancia.** Esa se calcula solo con la marca de
cumplido, para que siga siendo comparable sin importar quién anota más. Quien no
anota nada no queda peor medido.

Las acumulativas ganan además un **objetivo por día** opcional: sirve para
mostrar "5 de 20 km" al anotar, pero el avance de la meta lo sigue marcando el
objetivo total. Anotar menos del objetivo diario no es un fracaso: suma igual.

**Regla del choque diario/semanal.** Si una semana tiene cargas diarias, su total
sale de la suma de esos días y el registro semanal de esa semana se muestra
calculado, sin pedirlo de nuevo. Si no tiene cargas diarias, se sigue cargando a
mano. Sin esta regla, quien anotara los kilómetros día por día y además llenara
el resumen semanal contaría lo mismo dos veces.

### El límite de 3 metas se volvió una sugerencia

El spec proponía un máximo de 3 metas activas para forzar foco. Ya no se impone:
cada quien lleva las que quiera.

El costo sigue siendo real, así que la app lo dice en vez de bloquear. Todas las
metas activas se listan en la pantalla de Hoy, y el criterio de la sección 12 es
que marcar el día tome menos de diez segundos; con muchas metas eso deja de
cumplirse. Al pasar de tres aparece un aviso que explica el costo y ofrece
archivar. Decide el usuario, no la app.

La cuadrícula también se adaptó: hasta 5 metas dibuja una franja por meta, y de
ahí en adelante pasa a un relleno proporcional. Con 10 metas cada franja quedaría
en dos píxeles y sería ruido en vez de información.

### Mover el arranque del reto también mueve los ingresos

La constancia de cada persona se mide desde su `fecha_ingreso`, no desde el
arranque del reto. Si la app se configura tres días después de que el reto empezó
de verdad, todos quedan con una fecha de ingreso posterior: sus días anteriores no
cuentan y ni siquiera se pueden marcar.

Administración permite mover la fecha de arranque con una casilla para **alinear
las fechas de ingreso**. Es explícita y no un efecto silencioso, y solo mueve a
quienes ingresaron después del nuevo arranque: a quien entró tarde de verdad no lo
toca.

### Las metas archivadas no reescriben el pasado

Al dar de baja una meta: si tiene historial se **archiva**; si no tiene nada
registrado, se **elimina**. Borrar una meta con historial cambiaría hacia atrás la
constancia de días que ya pasaron.

### El tipo de meta no se puede cambiar

Define qué significan los registros ya guardados. Cambiarlo los volvería basura. La
app pide archivar y crear una nueva.

### Las fotos exigen sesión

Son fotos de personas, no assets públicos. Como el Worker sirve la SPA desde el
mismo origen, la cookie viaja sola en las peticiones de `<img>` y no hace falta nada
en el cliente.

---

## 4. Desvíos del modelo de datos del spec

Tres agregados, todos por necesidad concreta:

| Campo | Por qué |
|---|---|
| `eventos.clave` (único) | Idempotencia. Sin él, cada marca de día volvería a publicar «7 días seguidos». |
| `profiles.password_version` | Cambiar la contraseña invalida las sesiones abiertas. Sin esto, una sesión robada sobrevive al cambio de clave. |
| `participaciones.fecha_ingreso` | Día lógico de ingreso, separado de `created_at` (que es un timestamp UTC). La constancia se divide entre los días que a esa persona le corresponden. |
| `animos.fecha`, `animos.visto` | La fecha permite el límite de un ánimo por perfil por día; `visto` alimenta «ánimos recibidos desde la última visita». |
| `metas.completada_en` | Marca cuándo se alcanzó el objetivo, y evita publicar dos veces el evento. |
| `tokens_recuperacion` | El spec no modelaba la recuperación por correo. Guarda el SHA-256 del token; el token en claro solo viaja en el correo. |

Y un cambio: `frases` es única por `(reto_id, fecha)` en vez de por `fecha` sola,
porque el modelo es multi-reto.

---

## 5. Lo que quedó fuera

- **Push.** El spec ya lo posponía: en iOS solo funciona si la persona instala la
  app en su pantalla de inicio. El correo cubre v1.
- **Comentarios en el muro.** Necesitan moderación, y eso es otro proyecto. Los
  ánimos son la reacción de un toque.
- **Límite de intentos de login.** Para un reto por invitación es aceptable. Si el
  registro se abriera, se resuelve con Cloudflare Rate Limiting sobre `/api/login`
  desde el panel, sin tocar código.
- **Recorte interactivo de foto.** El recorte es cuadrado centrado, con reescalado a
  512 px y respeto de la orientación EXIF. Un recuadro arrastrable es mejora, no
  requisito.
