-- ════════════════════════════════════════════════════════════════════════════
-- Migración manual: reglas que Prisma no expresa en schema.prisma.
-- Explicación de cada regla: docs/modelo-datos.md
--   1. CHECK constraints (integridad de datos)
--   2. Bitácora de solo inserción (trigger)
--   3. Vista v_estado_clientes (el "semáforo")
--   4. Seguridad: RLS y permisos de los roles públicos de Supabase
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. CHECK constraints ──────────────────────────────────────────────────
-- La BD rechaza datos inválidos aunque la API tenga un bug.

ALTER TABLE "gimnasios"
  ADD CONSTRAINT "gimnasios_dias_aviso_rango_chk"
    CHECK ("dias_aviso_vencimiento" BETWEEN 0 AND 30);

ALTER TABLE "clientes"
  -- Teléfono normalizado: exactamente 10 dígitos (la API quita espacios y guiones)
  ADD CONSTRAINT "clientes_telefono_formato_chk"
    CHECK ("telefono" ~ '^[0-9]{10}$'),
  ADD CONSTRAINT "clientes_contacto_emergencia_telefono_formato_chk"
    CHECK ("contacto_emergencia_telefono" IS NULL OR "contacto_emergencia_telefono" ~ '^[0-9]{10}$'),
  -- Validación básica de formato; la validación completa la hace Zod en la API
  ADD CONSTRAINT "clientes_email_formato_chk"
    CHECK ("email" IS NULL OR "email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  -- Un registro bloqueado debe indicar desde cuándo (ciclo de vida LFPDPPP)
  ADD CONSTRAINT "clientes_bloqueo_con_fecha_chk"
    CHECK ("estado_registro" <> 'BLOQUEADO' OR "bloqueado_en" IS NOT NULL);

ALTER TABLE "planes"
  ADD CONSTRAINT "planes_precio_positivo_chk"
    CHECK ("precio" > 0),
  ADD CONSTRAINT "planes_duracion_rango_chk"
    CHECK ("duracion_meses" BETWEEN 1 AND 24);

ALTER TABLE "membresias"
  ADD CONSTRAINT "membresias_fechas_orden_chk"
    CHECK ("fecha_fin" >= "fecha_inicio"),
  -- >= 0 permite membresías de cortesía
  ADD CONSTRAINT "membresias_precio_no_negativo_chk"
    CHECK ("precio_acordado" >= 0);

ALTER TABLE "pagos"
  ADD CONSTRAINT "pagos_monto_positivo_chk"
    CHECK ("monto" > 0),
  -- Un pago VALIDO no tiene datos de anulación; uno ANULADO los tiene todos
  ADD CONSTRAINT "pagos_anulacion_coherente_chk"
    CHECK (
      ("estado" = 'VALIDO'
        AND "anulado_en" IS NULL AND "anulado_por" IS NULL AND "motivo_anulacion" IS NULL)
      OR
      ("estado" = 'ANULADO'
        AND "anulado_en" IS NOT NULL AND "anulado_por" IS NOT NULL
        -- IS NOT NULL explícito: un CHECK que evalúa a NULL se considera aprobado
        AND "motivo_anulacion" IS NOT NULL AND length(trim("motivo_anulacion")) > 0)
    );

ALTER TABLE "consentimientos"
  ADD CONSTRAINT "consentimientos_revocacion_posterior_chk"
    CHECK ("revocado_en" IS NULL OR "revocado_en" >= "otorgado_en");


-- ─── 2. Bitácora de solo inserción ─────────────────────────────────────────
-- Un trigger, y no un REVOKE, porque la API se conecta como dueño de las
-- tablas y al dueño no se le pueden quitar permisos de forma efectiva.
-- El trigger se dispara para cualquier usuario.

CREATE FUNCTION "bitacora_auditoria_inmutable"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'bitacora_auditoria es de solo inserción: % no permitido', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

-- FOR EACH ROW: se ejecuta por cada fila que alguien intente modificar o borrar
CREATE TRIGGER "bitacora_auditoria_sin_update_delete"
  BEFORE UPDATE OR DELETE ON "bitacora_auditoria"
  FOR EACH ROW EXECUTE FUNCTION "bitacora_auditoria_inmutable"();

-- TRUNCATE vacía la tabla sin pasar fila por fila: necesita su propio trigger
CREATE TRIGGER "bitacora_auditoria_sin_truncate"
  BEFORE TRUNCATE ON "bitacora_auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION "bitacora_auditoria_inmutable"();


-- ─── 3. Vista v_estado_clientes (el "semáforo") ────────────────────────────
-- Única fuente de la regla de estado: la usan el dashboard, la lista, la ficha
-- y el email diario. El estado se calcula, nunca se guarda.

CREATE VIEW "v_estado_clientes"
WITH (security_invoker = true)  -- respeta los permisos de quien consulta, no los del creador
AS
WITH "ultima_membresia" AS (
  -- DISTINCT ON: una fila por cliente, la primera según el ORDER BY (la que vence más tarde)
  SELECT DISTINCT ON (m."cliente_id")
         m."cliente_id",
         m."id"       AS "membresia_id",
         m."plan_id",
         m."fecha_fin"
  FROM "membresias" m
  WHERE m."cancelada_en" IS NULL
    -- Una membresía sin pago válido no cuenta: si se anula el pago, el cliente queda vencido
    AND EXISTS (
      SELECT 1 FROM "pagos" p
      WHERE p."membresia_id" = m."id" AND p."estado" = 'VALIDO'
    )
  ORDER BY m."cliente_id", m."fecha_fin" DESC
)
SELECT c."id"           AS "cliente_id",
       c."gimnasio_id",
       c."nombres",
       c."apellidos",
       c."telefono",
       u."membresia_id",
       u."plan_id",
       u."fecha_fin",
       (u."fecha_fin" - hoy."fecha") AS "dias_restantes",
       CASE
         WHEN u."fecha_fin" IS NULL                                     THEN 'SIN_MEMBRESIA'
         WHEN u."fecha_fin" < hoy."fecha"                               THEN 'VENCIDO'
         WHEN u."fecha_fin" - hoy."fecha" <= g."dias_aviso_vencimiento" THEN 'POR_VENCER'
         ELSE 'ACTIVO'
       END AS "estado"
FROM "clientes" c
JOIN "gimnasios" g ON g."id" = c."gimnasio_id"
-- "Hoy" en la zona horaria del gimnasio, no en la del servidor (UTC)
CROSS JOIN LATERAL (
  SELECT (now() AT TIME ZONE g."zona_horaria")::date AS "fecha"
) hoy
LEFT JOIN "ultima_membresia" u ON u."cliente_id" = c."id"
WHERE c."estado_registro" = 'ACTIVO';


-- ─── 4. Seguridad: RLS y roles públicos de Supabase ────────────────────────
-- Defensa en profundidad (ADR 0005). Solo la API, conectada como dueño de las
-- tablas, accede a los datos. Los roles públicos de Supabase no ven nada.

-- RLS sin políticas = nadie, salvo el dueño, ve filas.
-- (El "automatic RLS" del proyecto ya lo activó; repetirlo es inofensivo y deja
--  la regla escrita en el repo para cualquier otra BD.)
ALTER TABLE "gimnasios"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "perfiles_staff"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clientes"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "planes"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membresias"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pagos"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consentimientos"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bitacora_auditoria" ENABLE ROW LEVEL SECURITY;

-- La tabla interna de Prisma no existe en la shadow database, por eso se comprueba antes
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Quitar todo permiso a los roles públicos, en tablas actuales y futuras.
-- Bloque DO: los roles anon/authenticated solo existen en Supabase; en un
-- PostgreSQL normal (por ejemplo, en una futura CI) esta parte se salta sin error.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END
$$;

-- Las funciones son ejecutables por PUBLIC por defecto; esta solo la usa el trigger
REVOKE ALL ON FUNCTION "bitacora_auditoria_inmutable"() FROM PUBLIC;
