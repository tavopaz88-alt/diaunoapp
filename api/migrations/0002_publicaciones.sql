-- Publicaciones y comentarios: que la gente cuente cómo va con sus palabras,
-- no solo lo que la app genera sola.
--
-- El muro de logros (tabla `eventos`) sigue existiendo y sigue siendo
-- automático y cronológico. Esto es otra cosa y va aparte: texto escrito por
-- personas, que se puede comentar y se puede borrar.

CREATE TABLE publicaciones (
  id         TEXT PRIMARY KEY,
  reto_id    TEXT NOT NULL REFERENCES retos(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  -- Opcional: la publicación puede colgar de una meta. La API impide colgarla
  -- de una meta `privada`, porque el título es justo lo que su dueño reservó.
  meta_id    TEXT REFERENCES metas(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Sube con cada comentario nuevo. Es el criterio de orden del feed: las
  -- conversaciones vivas quedan arriba SIN ordenar por popularidad, que
  -- volvería visible quién recibe atención y quién no.
  actividad_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_publicaciones_reto ON publicaciones(reto_id, actividad_en DESC);

CREATE TABLE comentarios (
  id             TEXT PRIMARY KEY,
  publicacion_id TEXT NOT NULL REFERENCES publicaciones(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  texto          TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_comentarios_publicacion ON comentarios(publicacion_id, created_at);

-- Los ánimos ahora también aplican a publicaciones.
ALTER TABLE animos ADD COLUMN publicacion_id TEXT REFERENCES publicaciones(id) ON DELETE CASCADE;

-- Un ánimo por persona por publicación.
CREATE UNIQUE INDEX ux_animos_publicacion ON animos(de_user_id, publicacion_id)
  WHERE publicacion_id IS NOT NULL;

-- El índice del ánimo "a un perfil" limitaba a uno por persona por día contando
-- solo evento_id. Ahora un ánimo a una publicación también tiene evento_id nulo,
-- así que chocaría con esa regla: hay que excluirlo explícitamente.
DROP INDEX ux_animos_perfil;
CREATE UNIQUE INDEX ux_animos_perfil ON animos(de_user_id, para_user_id, fecha)
  WHERE evento_id IS NULL AND publicacion_id IS NULL;
