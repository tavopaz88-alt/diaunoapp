-- Esquema inicial del reto de metas.
-- D1 / SQLite. Las fechas de "dia logico" se guardan como TEXT 'YYYY-MM-DD'
-- calculadas en la zona horaria del reto, nunca como timestamp: un DATE ligado
-- en UTC corre el dia para quienes estan en UTC-6.

-- ---------------------------------------------------------------- perfiles
CREATE TABLE profiles (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  password_version INTEGER NOT NULL DEFAULT 1,  -- al cambiar la clave invalida sesiones abiertas
  nombre           TEXT NOT NULL,
  foto_url         TEXT,
  es_admin         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_profiles_email ON profiles(email);

-- ------------------------------------------------------------------- retos
CREATE TABLE retos (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  fecha_inicio  TEXT NOT NULL,                  -- YYYY-MM-DD
  duracion_dias INTEGER NOT NULL DEFAULT 30,
  codigo_acceso TEXT NOT NULL UNIQUE,           -- decision 11.3: ingreso por invitacion
  activo        INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------- participaciones
CREATE TABLE participaciones (
  id                 TEXT PRIMARY KEY,
  reto_id            TEXT NOT NULL REFERENCES retos(id) ON DELETE CASCADE,
  user_id            TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fecha_ingreso      TEXT NOT NULL,             -- dia logico en que se unio
  aparece_en_ranking INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reto_id, user_id)
);

CREATE INDEX ix_participaciones_reto ON participaciones(reto_id);
CREATE INDEX ix_participaciones_user ON participaciones(user_id);

-- ------------------------------------------------------------------- metas
CREATE TABLE metas (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reto_id        TEXT NOT NULL REFERENCES retos(id) ON DELETE CASCADE,
  titulo         TEXT NOT NULL,
  descripcion    TEXT,
  tipo           TEXT NOT NULL CHECK (tipo IN ('habito','acumulativo','medicion','hito')),
  visibilidad    TEXT NOT NULL DEFAULT 'titulo'
                   CHECK (visibilidad IN ('privada','titulo','completa')),
  unidad         TEXT,                          -- null en habito e hito
  valor_inicial  REAL,                          -- solo medicion
  valor_objetivo REAL,                          -- medicion y acumulativo
  direccion      TEXT CHECK (direccion IN ('subir','bajar')),  -- solo medicion
  orden          INTEGER NOT NULL DEFAULT 0,
  archivada      INTEGER NOT NULL DEFAULT 0,
  completada_en  TEXT,                          -- dia en que alcanzo el objetivo
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),

  -- La configuracion tiene que ser coherente con el tipo. Se valida tambien en
  -- la API, pero dejarlo en el esquema evita filas invalidas por cualquier via.
  CHECK (tipo <> 'medicion'
         OR (unidad IS NOT NULL AND valor_inicial IS NOT NULL
             AND valor_objetivo IS NOT NULL AND direccion IS NOT NULL)),
  CHECK (tipo <> 'acumulativo'
         OR (unidad IS NOT NULL AND valor_objetivo IS NOT NULL AND valor_objetivo > 0)),
  CHECK (tipo NOT IN ('habito','hito')
         OR (unidad IS NULL AND valor_inicial IS NULL
             AND valor_objetivo IS NULL AND direccion IS NULL))
);

CREATE INDEX ix_metas_user_reto ON metas(user_id, reto_id);
CREATE INDEX ix_metas_reto ON metas(reto_id);

-- -------------------------------------------------------- registros diarios
-- Solo dicen "cumplio / no cumplio". No revelan contenido, por eso son la base
-- de la constancia y lo unico comparable entre personas.
CREATE TABLE registros_diarios (
  id         TEXT PRIMARY KEY,
  meta_id    TEXT NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  cumplido   INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (meta_id, fecha)
);

CREATE INDEX ix_diarios_fecha ON registros_diarios(fecha);

-- ------------------------------------------------------ registros semanales
CREATE TABLE registros_semanales (
  id            TEXT PRIMARY KEY,
  meta_id       TEXT NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  semana_inicio TEXT NOT NULL,                  -- lunes de la semana (cierra domingo)
  valor         REAL,                           -- acumulativo y medicion
  texto         TEXT,                           -- hito
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (meta_id, semana_inicio)
);

CREATE INDEX ix_semanales_meta ON registros_semanales(meta_id);

-- ------------------------------------------------------------------ frases
CREATE TABLE frases (
  id         TEXT PRIMARY KEY,
  reto_id    TEXT NOT NULL REFERENCES retos(id) ON DELETE CASCADE,
  fecha      TEXT NOT NULL,
  texto      TEXT NOT NULL,
  autor_id   TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reto_id, fecha)
);

-- ----------------------------------------------------------------- eventos
-- Alimenta el muro de logros. SOLO eventos positivos: no existe un tipo para
-- rachas rotas ni para inactividad, y no debe agregarse ninguno.
CREATE TABLE eventos (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reto_id    TEXT NOT NULL REFERENCES retos(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL CHECK (tipo IN ('racha','meta_completada','logro','ingreso')),
  meta_id    TEXT REFERENCES metas(id) ON DELETE CASCADE,
  detalle    TEXT,
  clave      TEXT NOT NULL UNIQUE,              -- idempotencia: un mismo hito no se publica dos veces
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX ix_eventos_reto_fecha ON eventos(reto_id, created_at DESC);

-- ------------------------------------------------------------------ animos
CREATE TABLE animos (
  id           TEXT PRIMARY KEY,
  de_user_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  para_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  evento_id    TEXT REFERENCES eventos(id) ON DELETE CASCADE,
  fecha        TEXT NOT NULL,
  visto        INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Un animo por persona por evento.
CREATE UNIQUE INDEX ux_animos_evento ON animos(de_user_id, evento_id)
  WHERE evento_id IS NOT NULL;
-- Y como maximo un animo por persona por perfil por dia.
CREATE UNIQUE INDEX ux_animos_perfil ON animos(de_user_id, para_user_id, fecha)
  WHERE evento_id IS NULL;

CREATE INDEX ix_animos_destino ON animos(para_user_id, visto);

-- ------------------------------------------------- recuperacion de contrasena
CREATE TABLE tokens_recuperacion (
  token_hash TEXT PRIMARY KEY,                  -- SHA-256 del token; el token plano solo viaja por correo
  user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expira_en  TEXT NOT NULL,
  usado      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
