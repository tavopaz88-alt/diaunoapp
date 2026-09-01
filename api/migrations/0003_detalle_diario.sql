-- Detalle en el registro diario.
--
-- La pregunta diaria sigue siendo la misma para todos los tipos: ¿cumpliste hoy?
-- Eso no cambia, porque es lo que se llena en segundos y lo único comparable
-- entre personas (la constancia se calcula solo con `cumplido`).
--
-- Lo que se agrega es OPCIONAL y va encima: cuánto hiciste y qué hiciste.

-- Cuántas unidades hiciste ese día. Solo tiene sentido en metas acumulativas.
ALTER TABLE registros_diarios ADD COLUMN cantidad REAL;

-- Qué hiciste ese día, en tus palabras. Aplica a cualquier tipo.
ALTER TABLE registros_diarios ADD COLUMN nota TEXT;

-- Objetivo por día, opcional, solo en acumulativas: "20 km diarios".
-- El objetivo total (valor_objetivo) sigue siendo el que manda para el avance;
-- este solo sirve para mostrar "5 de 20" en el día.
ALTER TABLE metas ADD COLUMN objetivo_diario REAL;
