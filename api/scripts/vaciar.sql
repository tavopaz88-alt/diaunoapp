-- ============================================================================
--  BORRA TODOS LOS DATOS. No hay vuelta atrás.
--
--  Deja el esquema intacto y las tablas vacías, así que la aplicación vuelve a
--  quedar "sin instalar" y /instalar se habilita de nuevo. Sirve para arrancar
--  el reto de verdad después de haber estado probando.
--
--  NO borra:
--    - los secretos del Worker (JWT_SECRET, SETUP_TOKEN siguen sirviendo)
--    - las fotos de perfil en R2 (ver docs/despliegue.md para limpiarlas)
--
--  Uso:
--    npm run cf:vaciar-todo      (base de producción)
--    npm run vaciar-local        (base local de desarrollo)
-- ============================================================================

-- El orden va de las tablas hoja hacia las raíces. Las claves foráneas están en
-- CASCADE, así que borrar profiles y retos bastaría, pero hacerlo explícito deja
-- claro qué se está tirando y no depende de que el CASCADE esté bien puesto.
DELETE FROM animos;
DELETE FROM eventos;
DELETE FROM registros_semanales;
DELETE FROM registros_diarios;
DELETE FROM metas;
DELETE FROM frases;
DELETE FROM participaciones;
DELETE FROM tokens_recuperacion;
DELETE FROM retos;
DELETE FROM profiles;
