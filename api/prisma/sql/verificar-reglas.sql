-- ════════════════════════════════════════════════════════════════════════════
-- Verificación de las reglas de la BD (CHECK, UNIQUE, bitácora, vista, permisos).
-- Uso: pegar completo en Supabase → SQL Editor → Run.
--
-- Todo corre dentro de un solo bloque DO que TERMINA EN ERROR A PROPÓSITO:
-- el error trae el reporte y, al abortar, PostgreSQL revierte todos los datos de
-- prueba. Así no queda basura, ni siquiera en la bitácora de solo inserción.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  hoy    date := (now() AT TIME ZONE 'America/Mexico_City')::date;
  g      uuid;
  s      uuid := gen_random_uuid();
  p      uuid;
  c      uuid;
  m      uuid;
  fila   record;
  r      text := '';
  ok     int  := 0;
  fallos int  := 0;
BEGIN
  -- ─── Datos base ──────────────────────────────────────────────────────────
  -- updated_at se pone a mano: @updatedAt lo maneja Prisma Client, no la BD
  INSERT INTO gimnasios (nombre, email_notificaciones, updated_at)
  VALUES ('Gym de prueba', 'prueba@example.com', now()) RETURNING id INTO g;

  INSERT INTO perfiles_staff (id, gimnasio_id, nombre, rol, updated_at)
  VALUES (s, g, 'Staff de prueba', 'ADMIN', now());

  INSERT INTO planes (gimnasio_id, nombre, precio, duracion_meses, updated_at)
  VALUES (g, 'Mensual', 500, 1, now()) RETURNING id INTO p;

  -- ─── 1. Reglas que deben RECHAZAR datos ──────────────────────────────────
  -- Cada BEGIN…EXCEPTION es un savepoint: si el INSERT falla, solo se revierte ese bloque.

  BEGIN
    INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
    VALUES (g, 'X', 'Y', '123', now());
    r := r || E'\n❌ Teléfono de 3 dígitos fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Teléfono inválido rechazado'; ok := ok + 1;
  END;

  BEGIN
    INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, email, updated_at)
    VALUES (g, 'X', 'Y', '5599999999', 'correo-sin-arroba', now());
    r := r || E'\n❌ Email inválido fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Email inválido rechazado'; ok := ok + 1;
  END;

  BEGIN
    INSERT INTO planes (gimnasio_id, nombre, precio, duracion_meses, updated_at)
    VALUES (g, 'Negativo', -1, 1, now());
    r := r || E'\n❌ Plan con precio negativo fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Precio negativo rechazado'; ok := ok + 1;
  END;

  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'Base', 'Prueba', '5500000000', now()) RETURNING id INTO c;

  BEGIN
    INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
    VALUES (g, 'Duplicado', 'Prueba', '5500000000', now());
    r := r || E'\n❌ Teléfono duplicado fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN unique_violation THEN
    r := r || E'\n✅ Teléfono duplicado en el mismo gimnasio rechazado'; ok := ok + 1;
  END;

  BEGIN
    INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
    VALUES (g, c, p, hoy, hoy - 1, 500, s, now());
    r := r || E'\n❌ Membresía con fin antes del inicio fue aceptada'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Fechas de membresía invertidas rechazadas'; ok := ok + 1;
  END;

  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy, hoy + 30, 500, s, now()) RETURNING id INTO m;

  BEGIN
    INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, registrado_por, updated_at)
    VALUES (g, m, 0, 'EFECTIVO', s, now());
    r := r || E'\n❌ Pago de $0 fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Pago de $0 rechazado'; ok := ok + 1;
  END;

  BEGIN
    INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, estado, anulado_en, anulado_por, registrado_por, updated_at)
    VALUES (g, m, 500, 'EFECTIVO', 'ANULADO', now(), s, s, now());
    r := r || E'\n❌ Pago anulado SIN motivo fue aceptado'; fallos := fallos + 1;
  EXCEPTION WHEN check_violation THEN
    r := r || E'\n✅ Pago anulado sin motivo rechazado (la trampa del NULL)'; ok := ok + 1;
  END;

  -- ─── 2. Bitácora de solo inserción ───────────────────────────────────────
  INSERT INTO bitacora_auditoria (gimnasio_id, actor_id, accion, entidad)
  VALUES (g, s, 'PRUEBA', 'test');
  r := r || E'\n✅ La bitácora acepta inserciones'; ok := ok + 1;

  BEGIN
    UPDATE bitacora_auditoria SET accion = 'ALTERADA' WHERE gimnasio_id = g;
    r := r || E'\n❌ La bitácora permitió UPDATE'; fallos := fallos + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || E'\n✅ UPDATE en bitácora bloqueado'; ok := ok + 1;
  END;

  BEGIN
    DELETE FROM bitacora_auditoria WHERE gimnasio_id = g;
    r := r || E'\n❌ La bitácora permitió DELETE'; fallos := fallos + 1;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || E'\n✅ DELETE en bitácora bloqueado'; ok := ok + 1;
  END;

  -- ─── 3. Vista del semáforo ───────────────────────────────────────────────
  -- El nombre de cada cliente es el estado ESPERADO; luego se compara con la vista.

  -- ACTIVO: vence en 20 días
  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'ACTIVO', 'Caso 1', '5500000001', now()) RETURNING id INTO c;
  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy - 10, hoy + 20, 500, s, now()) RETURNING id INTO m;
  INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, registrado_por, updated_at)
  VALUES (g, m, 500, 'EFECTIVO', s, now());

  -- POR_VENCER: vence en 3 días (aviso = 7)
  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'POR_VENCER', 'Caso 2', '5500000002', now()) RETURNING id INTO c;
  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy - 27, hoy + 3, 500, s, now()) RETURNING id INTO m;
  INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, registrado_por, updated_at)
  VALUES (g, m, 500, 'TARJETA', s, now());

  -- VENCIDO: venció hace 2 días
  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'VENCIDO', 'Caso 3', '5500000003', now()) RETURNING id INTO c;
  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy - 32, hoy - 2, 500, s, now()) RETURNING id INTO m;
  INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, registrado_por, updated_at)
  VALUES (g, m, 500, 'TRANSFERENCIA', s, now());

  -- SIN_MEMBRESIA: nunca ha pagado
  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'SIN_MEMBRESIA', 'Caso 4', '5500000004', now());

  -- VENCIDO por pago anulado: tenía una membresía vencida y la renovación se anuló
  INSERT INTO clientes (gimnasio_id, nombres, apellidos, telefono, updated_at)
  VALUES (g, 'VENCIDO', 'Caso 5 (renovación anulada)', '5500000005', now()) RETURNING id INTO c;
  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy - 35, hoy - 5, 500, s, now()) RETURNING id INTO m;
  INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, registrado_por, updated_at)
  VALUES (g, m, 500, 'EFECTIVO', s, now());
  INSERT INTO membresias (gimnasio_id, cliente_id, plan_id, fecha_inicio, fecha_fin, precio_acordado, creada_por, updated_at)
  VALUES (g, c, p, hoy - 4, hoy + 26, 500, s, now()) RETURNING id INTO m;
  INSERT INTO pagos (gimnasio_id, membresia_id, monto, metodo, estado, anulado_en, anulado_por, motivo_anulacion, registrado_por, updated_at)
  VALUES (g, m, 500, 'EFECTIVO', 'ANULADO', now(), s, 'Billete falso', s, now());

  FOR fila IN
    SELECT nombres, apellidos, estado, dias_restantes
    FROM v_estado_clientes
    WHERE gimnasio_id = g AND apellidos LIKE 'Caso%'
    ORDER BY apellidos
  LOOP
    IF fila.nombres = fila.estado THEN
      r := r || format(E'\n✅ Vista: %s → %s (días restantes: %s)', fila.apellidos, fila.estado, coalesce(fila.dias_restantes::text, '—'));
      ok := ok + 1;
    ELSE
      r := r || format(E'\n❌ Vista: %s esperaba %s y obtuvo %s', fila.apellidos, fila.nombres, fila.estado);
      fallos := fallos + 1;
    END IF;
  END LOOP;

  -- ─── 4. Roles públicos de Supabase sin acceso ────────────────────────────
  IF pg_has_role('anon', 'MEMBER') THEN
    BEGIN
      SET LOCAL ROLE anon;
      PERFORM count(*) FROM clientes;
      RESET ROLE;
      r := r || E'\n❌ El rol anon pudo leer clientes'; fallos := fallos + 1;
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || E'\n✅ El rol anon no puede leer clientes (permiso denegado)'; ok := ok + 1;
    END;
  ELSE
    r := r || E'\n⏭️ Prueba de rol anon omitida (este usuario no puede asumir ese rol)';
  END IF;

  -- ─── Reporte final + reversión de todo ───────────────────────────────────
  RAISE EXCEPTION '%', format(E'REPORTE (todo se revirtió, no quedó ningún dato): %s OK, %s fallos\n%s', ok, fallos, r);
END
$$;
