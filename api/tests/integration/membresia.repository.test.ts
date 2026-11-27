// Tests de integración del repositorio REAL de membresías (spec 0005) contra Postgres.
// Cubren lo que el repositorio falso no puede probar: la vista v_estado_clientes (el semáforo),
// el candado FOR UPDATE con dos cobros simultáneos, "qué cuenta" en la consulta de Prisma,
// el rollback de la transacción y el aislamiento por gimnasio.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { aDate, hoyEn, sumarDias } from "../../src/lib/fechas.js";
import { createMembresiaRepository, type NuevaMembresia, type Periodo } from "../../src/repositories/membresia.repository.js";
import { planificarPeriodo } from "../../src/services/membresia.service.js";
import { bitacoraDe, crearGimnasio, crearStaff, prisma } from "./db.js";

const repo = createMembresiaRepository(prisma);

// La vista calcula "hoy" con now() de Postgres en la zona del gimnasio (por defecto, Ciudad de México).
// Las fechas de los tests se arman relativas a ese mismo "hoy".
const hoy = hoyEn("America/Mexico_City");
const dias = (n: number) => sumarDias(hoy, n);

let mio: { id: string; nombre: string };
let ajeno: { id: string; nombre: string };
let actor: { id: string; nombre: string };
let planId: string;

async function crearPlan(gimnasioId: string) {
  const plan = await prisma.plan.create({ data: { gimnasioId, nombre: "Mensual", precio: "500.00", duracionMeses: 1 }, select: { id: true } });
  return plan.id;
}

let telefono = 5510000000;
async function crearCliente(gimnasioId: string, estado: "ACTIVO" | "BLOQUEADO" = "ACTIVO") {
  const { id } = await prisma.cliente.create({
    data: {
      gimnasioId,
      nombres: "Cliente",
      apellidos: "De Prueba",
      telefono: String(telefono++),
      fechaInscripcion: aDate("2026-01-10"),
      estadoRegistro: estado,
      bloqueadoEn: estado === "BLOQUEADO" ? new Date() : null, // el CHECK lo exige
    },
  });
  return id;
}

/** Inserta con Prisma directo (no con el repo) una membresía y, si se pide, su pago. */
async function insertarMembresia(
  clienteId: string,
  fechaInicio: string,
  fechaFin: string,
  { pago = "VALIDO", cancelada = false, gimnasioId = mio.id }: { pago?: "VALIDO" | "ANULADO" | null; cancelada?: boolean; gimnasioId?: string } = {},
) {
  const { id } = await prisma.membresia.create({
    data: {
      gimnasioId,
      clienteId,
      planId,
      fechaInicio: aDate(fechaInicio),
      fechaFin: aDate(fechaFin),
      precioAcordado: "500.00",
      creadaPorId: actor.id,
      canceladaEn: cancelada ? new Date() : null,
    },
  });
  if (pago) {
    await prisma.pago.create({
      data: {
        gimnasioId,
        membresiaId: id,
        monto: "500.00",
        metodo: "EFECTIVO",
        registradoPorId: actor.id,
        estado: pago,
        // El CHECK pagos_anulacion_coherente_chk exige los tres datos al anular
        ...(pago === "ANULADO" && { anuladoEn: new Date(), anuladoPorId: actor.id, motivoAnulacion: "Cobro duplicado" }),
      },
    });
  }
  return id;
}

/** Un `planificar` fijo: guarda lo que le pasen y devuelve siempre el mismo periodo. */
function planFijo(fechaInicio: string, fechaFin: string) {
  const recibido: Periodo[][] = [];
  const planificar = vi.fn((ocupados: Periodo[]): NuevaMembresia => {
    recibido.push(ocupados);
    return { planId, fechaInicio, fechaFin, precio: "500.00", metodo: "TARJETA", folio: "A-1" };
  });
  return { planificar, recibido };
}

beforeEach(async () => {
  [mio, ajeno] = await Promise.all([crearGimnasio(), crearGimnasio()]);
  actor = await crearStaff(mio.id, { nombre: "Ana López", rol: "RECEPCION" });
  planId = await crearPlan(mio.id);
});

describe("estado (vista v_estado_clientes)", () => {
  it("caso 16: sin membresías → SIN_MEMBRESIA", async () => {
    const clienteId = await crearCliente(mio.id);

    expect(await repo.estado(mio.id, clienteId)).toEqual({ estado: "SIN_MEMBRESIA", diasRestantes: null, fechaFin: null, membresiaId: null });
  });

  it("caso 20: ACTIVO, POR_VENCER (≤ 7 días de aviso) y VENCIDO con días negativos", async () => {
    const [activo, porVencer, vencido] = await Promise.all([crearCliente(mio.id), crearCliente(mio.id), crearCliente(mio.id)]);
    const idActivo = await insertarMembresia(activo, dias(-10), dias(20));
    await insertarMembresia(porVencer, dias(-25), dias(7)); // justo en el límite: sigue "por vencer"
    await insertarMembresia(vencido, dias(-35), dias(-5));

    expect(await repo.estado(mio.id, activo)).toEqual({ estado: "ACTIVO", diasRestantes: 20, fechaFin: dias(20), membresiaId: idActivo });
    expect(await repo.estado(mio.id, porVencer)).toMatchObject({ estado: "POR_VENCER", diasRestantes: 7 });
    expect(await repo.estado(mio.id, vencido)).toMatchObject({ estado: "VENCIDO", diasRestantes: -5, fechaFin: dias(-5) });
  });

  it("caso 20: vence HOY → POR_VENCER con 0 días (hoy todavía puede entrar)", async () => {
    const clienteId = await crearCliente(mio.id);
    await insertarMembresia(clienteId, dias(-29), hoy);

    expect(await repo.estado(mio.id, clienteId)).toMatchObject({ estado: "POR_VENCER", diasRestantes: 0 });
  });

  it("caso 21: una membresía con el pago anulado, cancelada o sin pago no cuenta", async () => {
    const [anulado, cancelada, sinPago] = await Promise.all([crearCliente(mio.id), crearCliente(mio.id), crearCliente(mio.id)]);
    // Las tres tienen una vieja (vencida) que sí cuenta, y una nueva (vigente) que no
    for (const clienteId of [anulado, cancelada, sinPago]) await insertarMembresia(clienteId, dias(-60), dias(-31));
    await insertarMembresia(anulado, dias(-5), dias(25), { pago: "ANULADO" });
    await insertarMembresia(cancelada, dias(-5), dias(25), { cancelada: true });
    await insertarMembresia(sinPago, dias(-5), dias(25), { pago: null });

    for (const clienteId of [anulado, cancelada, sinPago]) {
      expect(await repo.estado(mio.id, clienteId)).toMatchObject({ estado: "VENCIDO", fechaFin: dias(-31) });
    }
  });

  it("caso 17: cliente de otro gimnasio, bloqueado o inexistente → null", async () => {
    const [ajenoId, bloqueadoId] = await Promise.all([crearCliente(ajeno.id), crearCliente(mio.id, "BLOQUEADO")]);

    expect(await repo.estado(mio.id, ajenoId)).toBeNull();
    expect(await repo.estado(mio.id, bloqueadoId)).toBeNull();
    expect(await repo.estado(mio.id, randomUUID())).toBeNull();
  });
});

describe("contratar", () => {
  it("guarda la membresía, su pago y dos filas en la bitácora, en una transacción", async () => {
    const clienteId = await crearCliente(mio.id);
    const { planificar } = planFijo(dias(0), dias(29));

    const membresia = await repo.contratar(mio.id, clienteId, actor.id, planificar);

    expect(membresia).toEqual({
      id: expect.any(String),
      plan: { id: planId, nombre: "Mensual" },
      fechaInicio: dias(0),
      fechaFin: dias(29),
      precioAcordado: "500.00",
      canceladaEn: null,
      cuenta: true,
      pagos: [
        {
          id: expect.any(String),
          monto: "500.00",
          metodo: "TARJETA",
          folio: "A-1",
          estado: "VALIDO",
          fechaPago: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
          registradoPor: { id: actor.id, nombre: "Ana López" },
        },
      ],
    });
    const pagoId = membresia?.pagos[0]?.id ?? "";

    const [deMembresia, dePago] = await Promise.all([bitacoraDe(mio.id, membresia?.id ?? "", "membresias"), bitacoraDe(mio.id, pagoId, "pagos")]);
    expect(deMembresia).toHaveLength(1);
    expect(deMembresia[0]).toMatchObject({ accion: "CREAR", actorId: actor.id, datosAntes: null });
    expect(deMembresia[0]?.datosDespues).toEqual({ clienteId, planId, fechaInicio: dias(0), fechaFin: dias(29), precioAcordado: "500.00" });
    expect(dePago[0]?.datosDespues).toEqual({ membresiaId: membresia?.id, monto: "500.00", metodo: "TARJETA", folio: "A-1" });

    // Y el estado de la vista ya la ve
    expect(await repo.estado(mio.id, clienteId)).toMatchObject({ estado: "ACTIVO", membresiaId: membresia?.id });
  });

  it("caso 24: a planificar solo le llegan los periodos que cuentan", async () => {
    const clienteId = await crearCliente(mio.id);
    await insertarMembresia(clienteId, dias(-60), dias(-31));
    await insertarMembresia(clienteId, dias(-30), dias(-1));
    await insertarMembresia(clienteId, dias(0), dias(29), { pago: "ANULADO" });
    await insertarMembresia(clienteId, dias(30), dias(59), { cancelada: true });
    await insertarMembresia(clienteId, dias(60), dias(89), { pago: null });
    const { planificar, recibido } = planFijo(dias(0), dias(29));

    await repo.contratar(mio.id, clienteId, actor.id, planificar);

    expect(recibido).toEqual([
      [
        { fechaInicio: dias(-60), fechaFin: dias(-31) },
        { fechaInicio: dias(-30), fechaFin: dias(-1) },
      ],
    ]);
  });

  it("caso 13: cliente de otro gimnasio, bloqueado o inexistente → null, sin llamar a planificar ni guardar nada", async () => {
    const [ajenoId, bloqueadoId] = await Promise.all([crearCliente(ajeno.id), crearCliente(mio.id, "BLOQUEADO")]);
    const { planificar } = planFijo(dias(0), dias(29));

    for (const clienteId of [ajenoId, bloqueadoId, randomUUID()]) {
      expect(await repo.contratar(mio.id, clienteId, actor.id, planificar)).toBeNull();
    }
    expect(planificar).not.toHaveBeenCalled();
    expect(await prisma.membresia.count({ where: { clienteId: { in: [ajenoId, bloqueadoId] } } })).toBe(0);
  });

  it("si planificar lanza un error (p. ej. el 409), no se guarda nada", async () => {
    const clienteId = await crearCliente(mio.id);

    await expect(
      repo.contratar(mio.id, clienteId, actor.id, () => {
        throw new Error("se encima");
      }),
    ).rejects.toThrow("se encima");
    expect(await prisma.membresia.count({ where: { clienteId } })).toBe(0);
  });

  it("caso 22: dos cobros simultáneos al mismo cliente quedan consecutivos, sin encimarse", async () => {
    const clienteId = await crearCliente(mio.id);
    await insertarMembresia(clienteId, dias(-20), dias(9));
    // El planificar de verdad, como lo usa el servicio
    const planificar = (ocupados: Periodo[]): NuevaMembresia => ({
      ...planificarPeriodo(ocupados, { hoy, meses: 1 }),
      planId,
      precio: "500.00",
      metodo: "EFECTIVO",
      folio: null,
    });

    // Promise.all: las dos transacciones arrancan a la vez, en conexiones distintas
    const nuevas = await Promise.all([
      repo.contratar(mio.id, clienteId, actor.id, planificar),
      repo.contratar(mio.id, clienteId, actor.id, planificar),
    ]);

    const [primera, segunda] = nuevas.map((m) => m as NonNullable<typeof m>).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    expect(primera?.fechaInicio).toBe(dias(10));
    expect(segunda?.fechaInicio).toBe(sumarDias(primera?.fechaFin ?? "", 1));
  });
});

describe("historial", () => {
  it("caso 15: de la más reciente a la más vieja, con cuenta y pagos; nunca las de otro gimnasio", async () => {
    const clienteId = await crearCliente(mio.id);
    await insertarMembresia(clienteId, dias(-60), dias(-31));
    await insertarMembresia(clienteId, dias(-30), dias(-1), { pago: "ANULADO" });
    await insertarMembresia(clienteId, dias(0), dias(29));

    const historial = await repo.historial(mio.id, clienteId);

    expect(historial.map((m) => [m.fechaInicio, m.cuenta])).toEqual([
      [dias(0), true],
      [dias(-30), false],
      [dias(-60), true],
    ]);
    expect(historial[1]?.pagos).toEqual([expect.objectContaining({ estado: "ANULADO", monto: "500.00", registradoPor: { id: actor.id, nombre: "Ana López" } })]);
    // Pedido desde otro gimnasio: vacío
    expect(await repo.historial(ajeno.id, clienteId)).toEqual([]);
  });
});

describe("caso 23: si falla la bitácora, no queda ni la membresía ni el pago (rollback)", () => {
  // Otro nombre de trigger que en los demás archivos: corren en paralelo contra la misma BD.
  // El saboteador debe ser un perfil real: creada_por y registrado_por son FK a perfiles_staff.
  const SABOTEADOR = randomUUID();
  let gimnasioSab: { id: string };
  let clienteSab: string;

  beforeAll(async () => {
    gimnasioSab = await crearGimnasio();
    await prisma.perfilStaff.create({ data: { id: SABOTEADOR, gimnasioId: gimnasioSab.id, nombre: "Saboteador", rol: "RECEPCION" } });
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION test_bitacora_falla_membresias() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'bitácora caída (simulado por el test)'; END; $$`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_bitacora_falla_membresias BEFORE INSERT ON bitacora_auditoria
      FOR EACH ROW WHEN (NEW.actor_id = '${SABOTEADOR}'::uuid) EXECUTE FUNCTION test_bitacora_falla_membresias()`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS test_bitacora_falla_membresias ON bitacora_auditoria");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS test_bitacora_falla_membresias()");
  });

  beforeEach(async () => {
    clienteSab = await crearCliente(gimnasioSab.id);
    planId = await crearPlan(gimnasioSab.id).catch(async () => {
      // El plan "Mensual" ya existe en este gimnasio (nombre único): se reusa
      const plan = await prisma.plan.findFirstOrThrow({ where: { gimnasioId: gimnasioSab.id }, select: { id: true } });
      return plan.id;
    });
  });

  it("contratar: ni membresía ni pago", async () => {
    const { planificar } = planFijo(dias(0), dias(29));

    await expect(repo.contratar(gimnasioSab.id, clienteSab, SABOTEADOR, planificar)).rejects.toThrow(/bitácora caída/);
    expect(await prisma.membresia.count({ where: { clienteId: clienteSab } })).toBe(0);
    expect(await prisma.pago.count({ where: { gimnasioId: gimnasioSab.id } })).toBe(0);
  });

  it("spec 0007, caso 15 — anularPago: el pago sigue VALIDO y sin datos de anulación", async () => {
    const membresiaId = await insertarMembresia(clienteSab, dias(-5), dias(25), { gimnasioId: gimnasioSab.id });
    const { id: pagoId } = await prisma.pago.findFirstOrThrow({ where: { membresiaId }, select: { id: true } });

    await expect(repo.anularPago(gimnasioSab.id, pagoId, SABOTEADOR, "Cobro duplicado")).rejects.toThrow(/bitácora caída/);
    expect(await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).toMatchObject({
      estado: "VALIDO",
      anuladoEn: null,
      anuladoPorId: null,
      motivoAnulacion: null,
    });
  });
});

describe("anularPago (spec 0007)", () => {
  let clienteId: string;
  let membresiaId: string;
  let pagoId: string;
  let dueno: { id: string };

  beforeEach(async () => {
    clienteId = await crearCliente(mio.id);
    membresiaId = await insertarMembresia(clienteId, dias(-5), dias(25));
    pagoId = (await prisma.pago.findFirstOrThrow({ where: { membresiaId }, select: { id: true } })).id;
    dueno = await crearStaff(mio.id, { nombre: "Carlos Ruiz", rol: "DUENO" });
  });

  it("casos 1, 12 y 13: guarda estado, quién, cuándo y motivo (el CHECK los acepta), escribe la bitácora y devuelve la membresía", async () => {
    const antes = new Date();
    const resultado = await repo.anularPago(mio.id, pagoId, dueno.id, "Cobro duplicado");

    expect(resultado.tipo).toBe("anulado");
    if (resultado.tipo !== "anulado") return;
    expect(resultado.membresia).toMatchObject({ id: membresiaId, cuenta: false });
    expect(resultado.membresia.pagos).toEqual([
      expect.objectContaining({
        id: pagoId,
        estado: "ANULADO",
        anulacion: { anuladoEn: expect.any(String), anuladoPor: { id: dueno.id, nombre: "Carlos Ruiz" }, motivo: "Cobro duplicado" },
      }),
    ]);

    const fila = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } });
    expect(fila).toMatchObject({ estado: "ANULADO", anuladoPorId: dueno.id, motivoAnulacion: "Cobro duplicado" });
    expect(fila.anuladoEn!.getTime()).toBeGreaterThanOrEqual(antes.getTime() - 1000);

    expect(await bitacoraDe(mio.id, pagoId, "pagos")).toEqual([
      expect.objectContaining({
        actorId: dueno.id,
        accion: "ANULAR_PAGO",
        datosAntes: { estado: "VALIDO" },
        datosDespues: { estado: "ANULADO", motivo: "Cobro duplicado" },
      }),
    ]);
  });

  it("caso 10: la vista deja de contar esa membresía", async () => {
    expect(await repo.estado(mio.id, clienteId)).toMatchObject({ estado: "ACTIVO" });
    await repo.anularPago(mio.id, pagoId, dueno.id, "Cobro duplicado");
    expect(await repo.estado(mio.id, clienteId)).toMatchObject({ estado: "SIN_MEMBRESIA" });
  });

  it("caso 9: un pago ya anulado → ya-anulado, sin tocar el motivo original ni escribir otra bitácora", async () => {
    await repo.anularPago(mio.id, pagoId, dueno.id, "Cobro duplicado");
    expect(await repo.anularPago(mio.id, pagoId, dueno.id, "Otra vez")).toEqual({ tipo: "ya-anulado" });
    expect((await prisma.pago.findUniqueOrThrow({ where: { id: pagoId } })).motivoAnulacion).toBe("Cobro duplicado");
    expect(await bitacoraDe(mio.id, pagoId, "pagos")).toHaveLength(1);
  });

  it("casos 7, 8 y 16: desde otro gimnasio, de un cliente bloqueado o inexistente → no-existe y sin cambios", async () => {
    expect(await repo.anularPago(ajeno.id, pagoId, dueno.id, "Intruso")).toEqual({ tipo: "no-existe" });
    expect(await repo.anularPago(mio.id, randomUUID(), dueno.id, "x")).toEqual({ tipo: "no-existe" });

    const bloqueado = await crearCliente(mio.id, "BLOQUEADO");
    const deBloqueado = await insertarMembresia(bloqueado, dias(-5), dias(25));
    const pagoBloqueado = (await prisma.pago.findFirstOrThrow({ where: { membresiaId: deBloqueado }, select: { id: true } })).id;
    expect(await repo.anularPago(mio.id, pagoBloqueado, dueno.id, "x")).toEqual({ tipo: "no-existe" });

    expect(await prisma.pago.count({ where: { id: { in: [pagoId, pagoBloqueado] }, estado: "ANULADO" } })).toBe(0);
  });

  it("caso 14: dos anulaciones simultáneas → una gana y la otra recibe ya-anulado; una sola fila en la bitácora", async () => {
    const resultados = await Promise.all([
      repo.anularPago(mio.id, pagoId, dueno.id, "Primera"),
      repo.anularPago(mio.id, pagoId, dueno.id, "Segunda"),
    ]);

    expect(resultados.map((r) => r.tipo).sort()).toEqual(["anulado", "ya-anulado"]);
    expect(await bitacoraDe(mio.id, pagoId, "pagos")).toHaveLength(1);
  });
});
