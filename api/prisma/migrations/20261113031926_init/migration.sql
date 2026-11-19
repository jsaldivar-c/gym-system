-- CreateEnum
CREATE TYPE "rol_staff" AS ENUM ('ADMIN', 'DUENO', 'RECEPCION');

-- CreateEnum
CREATE TYPE "estado_registro" AS ENUM ('ACTIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "metodo_pago" AS ENUM ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "estado_pago" AS ENUM ('VALIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "tipo_consentimiento" AS ENUM ('AVISO_PRIVACIDAD', 'DATOS_SALUD', 'COMUNICACIONES');

-- CreateEnum
CREATE TYPE "medio_consentimiento" AS ENUM ('FIRMA_PAPEL', 'FIRMA_DIGITAL', 'CASILLA_DIGITAL');

-- CreateTable
CREATE TABLE "gimnasios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "email_notificaciones" TEXT NOT NULL,
    "dias_aviso_vencimiento" INTEGER NOT NULL DEFAULT 7,
    "zona_horaria" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "gimnasios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles_staff" (
    "id" UUID NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "rol_staff" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfiles_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gimnasio_id" UUID NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "fecha_nacimiento" DATE,
    "fecha_inscripcion" DATE NOT NULL DEFAULT CURRENT_DATE,
    "contacto_emergencia_nombre" TEXT,
    "contacto_emergencia_telefono" TEXT,
    "contacto_emergencia_parentesco" TEXT,
    "notas" TEXT,
    "estado_registro" "estado_registro" NOT NULL DEFAULT 'ACTIVO',
    "bloqueado_en" TIMESTAMPTZ(6),
    "suprimir_en" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gimnasio_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "duracion_meses" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membresias" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gimnasio_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "precio_acordado" DECIMAL(10,2) NOT NULL,
    "cancelada_en" TIMESTAMPTZ(6),
    "creada_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "membresias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gimnasio_id" UUID NOT NULL,
    "membresia_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_pago" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metodo" "metodo_pago" NOT NULL,
    "folio" TEXT,
    "estado" "estado_pago" NOT NULL DEFAULT 'VALIDO',
    "anulado_en" TIMESTAMPTZ(6),
    "anulado_por" UUID,
    "motivo_anulacion" TEXT,
    "registrado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimientos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gimnasio_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "tipo" "tipo_consentimiento" NOT NULL,
    "version_aviso" TEXT NOT NULL,
    "medio" "medio_consentimiento" NOT NULL,
    "otorgado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consentimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "gimnasio_id" UUID NOT NULL,
    "actor_id" UUID,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID,
    "datos_antes" JSONB,
    "datos_despues" JSONB,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perfiles_staff_gimnasio_id_idx" ON "perfiles_staff"("gimnasio_id");

-- CreateIndex
CREATE INDEX "clientes_gimnasio_id_apellidos_nombres_idx" ON "clientes"("gimnasio_id", "apellidos", "nombres");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_gimnasio_id_telefono_key" ON "clientes"("gimnasio_id", "telefono");

-- CreateIndex
CREATE UNIQUE INDEX "planes_gimnasio_id_nombre_key" ON "planes"("gimnasio_id", "nombre");

-- CreateIndex
CREATE INDEX "membresias_cliente_id_fecha_fin_idx" ON "membresias"("cliente_id", "fecha_fin" DESC);

-- CreateIndex
CREATE INDEX "membresias_gimnasio_id_fecha_fin_idx" ON "membresias"("gimnasio_id", "fecha_fin");

-- CreateIndex
CREATE INDEX "pagos_membresia_id_idx" ON "pagos"("membresia_id");

-- CreateIndex
CREATE INDEX "pagos_gimnasio_id_fecha_pago_idx" ON "pagos"("gimnasio_id", "fecha_pago");

-- CreateIndex
CREATE INDEX "consentimientos_cliente_id_tipo_idx" ON "consentimientos"("cliente_id", "tipo");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_gimnasio_id_entidad_entidad_id_idx" ON "bitacora_auditoria"("gimnasio_id", "entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "bitacora_auditoria_gimnasio_id_creado_en_idx" ON "bitacora_auditoria"("gimnasio_id", "creado_en");

-- AddForeignKey
ALTER TABLE "perfiles_staff" ADD CONSTRAINT "perfiles_staff_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planes" ADD CONSTRAINT "planes_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "planes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membresias" ADD CONSTRAINT "membresias_creada_por_fkey" FOREIGN KEY ("creada_por") REFERENCES "perfiles_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_membresia_id_fkey" FOREIGN KEY ("membresia_id") REFERENCES "membresias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_fkey" FOREIGN KEY ("registrado_por") REFERENCES "perfiles_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "perfiles_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_auditoria" ADD CONSTRAINT "bitacora_auditoria_gimnasio_id_fkey" FOREIGN KEY ("gimnasio_id") REFERENCES "gimnasios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
