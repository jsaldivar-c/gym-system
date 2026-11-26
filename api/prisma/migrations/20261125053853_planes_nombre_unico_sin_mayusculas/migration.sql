-- Spec 0003: el nombre de un plan es único dentro del gimnasio SIN distinguir mayúsculas.
-- El UNIQUE original distinguía "Mensual" de "mensual". La API comprueba antes de guardar,
-- pero si dos peticiones llegan a la vez ambas pasarían: la BD es la última barrera.
-- Prisma no puede expresar un índice sobre una expresión (lower(...)), por eso va aquí a mano.

-- DropIndex
DROP INDEX "planes_gimnasio_id_nombre_key";

-- La API guarda el nombre sin espacios al inicio ni al final (trim), así que basta con lower().
CREATE UNIQUE INDEX "planes_gimnasio_id_nombre_ci_key" ON "planes" ("gimnasio_id", lower("nombre"));
