// Tests de la spec 0005 (docs/specs/0005-api-membresias.md). Cada `it` es un caso de la tabla.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calcularFechaFin } from "../src/lib/fechas.js";
import type { Pago } from "../src/repositories/membresia.repository.js";
import { crearClienteRepositoryFalso, type FilaCliente } from "./fakes/cliente-repository.fake.js";
import { crearMembresiaRepositoryFalso, type FilaMembresia } from "./fakes/membresia-repository.fake.js";
import { crearPlanRepositoryFalso } from "./fakes/plan-repository.fake.js";
import { crearAppDePrueba, crearClaves, firmarToken, GIMNASIO, OTRO_GIMNASIO, USUARIOS } from "./helpers.js";

/** 26 de noviembre a las 7:30 p. m. en la Ciudad de México… pero ya 27 en UTC. */
const AHORA = new Date("2026-11-27T01:30:00Z");
const HOY = "2026-11-26";

const CLIENTE = {
  ana: "c0000000-0000-4000-8000-000000000001", // vigente hasta el 30 de noviembre
  luis: "c0000000-0000-4000-8000-000000000002", // venció hace 10 días; tiene una cancelada y una con pago anulado
  nuevo: "c0000000-0000-4000-8000-000000000003", // nunca ha pagado
  bloqueado: "c0000000-0000-4000-8000-000000000004",
  ajeno: "c0000000-0000-4000-8000-000000000099",
};

const PLAN = {
  mensual: { id: "a0000000-0000-4000-8000-000000000001", gimnasioId: GIMNASIO.id, nombre: "Mensual", precio: "500.00", duracionMeses: 1, activo: true },
  anual: { id: "a0000000-0000-4000-8000-000000000002", gimnasioId: GIMNASIO.id, nombre: "Anual", precio: "5000.00", duracionMeses: 12, activo: true },
  retirado: { id: "a0000000-0000-4000-8000-000000000003", gimnasioId: GIMNASIO.id, nombre: "Promo 2025", precio: "300.00", duracionMeses: 1, activo: false },
  ajeno: { id: "a0000000-0000-4000-8000-000000000099", gimnasioId: OTRO_GIMNASIO.id, nombre: "Mensual", precio: "1.00", duracionMeses: 1, activo: true },
};

function cliente(id: string, extra: Partial<FilaCliente> = {}): FilaCliente {
  return {
    id,
    gimnasioId: GIMNASIO.id,
    estadoRegistro: "ACTIVO",
    nombres: "Cliente",
    apellidos: id.slice(-2),
    telefono: `55000000${id.slice(-2)}`,
    fechaInscripcion: "2026-01-10",
    email: null,
    fechaNacimiento: null,
    contactoEmergenciaNombre: null,
    contactoEmergenciaTelefono: null,
    contactoEmergenciaParentesco: null,
    notas: null,
    ...extra,
  };
}

const clientes = (): FilaCliente[] => [
  cliente(CLIENTE.ana),
  cliente(CLIENTE.luis),
  cliente(CLIENTE.nuevo),
  cliente(CLIENTE.bloqueado, { estadoRegistro: "BLOQUEADO" }),
  cliente(CLIENTE.ajeno, { gimnasioId: OTRO_GIMNASIO.id }),
];

function pago(estado: Pago["estado"] = "VALIDO"): Pago {
  return {
    id: crypto.randomUUID(),
    monto: "500.00",
    metodo: "EFECTIVO",
    folio: null,
    estado,
    fechaPago: "2026-10-01T15:00:00.000Z",
    registradoPor: { id: USUARIOS.recepcion.id, nombre: USUARIOS.recepcion.nombre },
    anulacion:
      estado === "ANULADO"
        ? { anuladoEn: "2026-10-02T15:00:00.000Z", anuladoPor: { id: USUARIOS.dueno.id, nombre: USUARIOS.dueno.nombre }, motivo: "Cobro duplicado" }
        : null,
  };
}

function membresia(clienteId: string, fechaInicio: string, fechaFin: string, extra: Partial<FilaMembresia> = {}): FilaMembresia {
  return {
    id: crypto.randomUUID(),
    gimnasioId: GIMNASIO.id,
    clienteId,
    plan: { id: PLAN.mensual.id, nombre: "Mensual" },
    fechaInicio,
    fechaFin,
    precioAcordado: "500.00",
    canceladaEn: null,
    cuenta: true,
    pagos: [pago()],
    ...extra,
  };
}

const membresiasIniciales = (): FilaMembresia[] => [
  membresia(CLIENTE.ana, "2026-10-01", "2026-10-31"),
  membresia(CLIENTE.ana, "2026-11-01", "2026-11-30"),
  membresia(CLIENTE.luis, "2026-10-17", "2026-11-16"),
  membresia(CLIENTE.luis, "2026-11-20", "2026-12-19", { canceladaEn: "2026-11-21T18:00:00.000Z" }),
  membresia(CLIENTE.luis, "2026-12-20", "2027-01-19", { pagos: [pago("ANULADO")] }),
  membresia(CLIENTE.ajeno, "2026-11-01", "2026-11-30", { gimnasioId: OTRO_GIMNASIO.id }),
];

let claves: Awaited<ReturnType<typeof crearClaves>>;
let tokenRecepcion: string;

beforeAll(async () => {
  claves = await crearClaves();
  tokenRecepcion = await firmarToken(claves, { sub: USUARIOS.recepcion.id });
});

let bd: ReturnType<typeof crearMembresiaRepositoryFalso>;
let prueba: ReturnType<typeof crearAppDePrueba>;
beforeEach(() => {
  const filasClientes = clientes();
  bd = crearMembresiaRepositoryFalso({
    clientes: filasClientes,
    membresias: membresiasIniciales(),
    planes: Object.values(PLAN),
    staff: [USUARIOS.recepcion, USUARIOS.dueno, USUARIOS.admin],
    hoy: HOY,
    ahora: () => AHORA,
  });
  prueba = crearAppDePrueba({
    keys: claves.jwks,
    clienteRepository: crearClienteRepositoryFalso(filasClientes).repo,
    planRepository: crearPlanRepositoryFalso(Object.values(PLAN)).repo,
    membresiaRepository: bd.repo,
    ahora: () => AHORA,
  });
});

const url = (clienteId: string) => `/clientes/${clienteId}/membresias`;
const conToken = (req: request.Test) => req.set("Authorization", `Bearer ${tokenRecepcion}`);
const api = {
  get: (clienteId: string) => conToken(request(prueba.app).get(url(clienteId))),
  post: (clienteId: string, body: unknown) => conToken(request(prueba.app).post(url(clienteId))).send(body as object),
};
const cobro = (extra: Record<string, unknown> = {}) => ({ planId: PLAN.mensual.id, metodo: "EFECTIVO", ...extra });
const nuevasDe = (clienteId: string) => bd.filas.filter((m) => m.clienteId === clienteId && m.pagos[0]?.fechaPago === AHORA.toISOString());

describe("POST /clientes/:clienteId/membresias", () => {
  it("caso 1: primera membresía como RECEPCION: empieza hoy (zona del gimnasio) con el precio del plan", async () => {
    const res = await api.post(CLIENTE.nuevo, cobro({ folio: "  A-123 " }));

    expect(res.status).toBe(201);
    expect(res.headers.location).toBeUndefined();
    expect(res.body).toEqual({
      id: expect.any(String),
      plan: { id: PLAN.mensual.id, nombre: "Mensual" },
      fechaInicio: HOY, // y no el 27, que ya es en UTC
      fechaFin: "2026-12-25",
      precioAcordado: "500.00",
      canceladaEn: null,
      cuenta: true,
      pagos: [
        {
          id: expect.any(String),
          monto: "500.00",
          metodo: "EFECTIVO",
          folio: "A-123",
          estado: "VALIDO",
          fechaPago: AHORA.toISOString(),
          registradoPor: { id: USUARIOS.recepcion.id, nombre: USUARIOS.recepcion.nombre },
          anulacion: null, // spec 0007
        },
      ],
    });
  });

  it("caso 2: con una membresía vigente que vence el 30, la nueva empieza el día siguiente", async () => {
    const res = await api.post(CLIENTE.ana, cobro());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fechaInicio: "2026-12-01", fechaFin: "2026-12-31" });
  });

  it("caso 3: si la última venció hace 10 días, empieza hoy (las canceladas y anuladas no cuentan)", async () => {
    const res = await api.post(CLIENTE.luis, cobro());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fechaInicio: HOY, fechaFin: "2026-12-25" });
  });

  it("caso 4: plan de 12 meses", async () => {
    const res = await api.post(CLIENTE.nuevo, cobro({ planId: PLAN.anual.id, metodo: "TARJETA" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fechaInicio: HOY, fechaFin: "2027-11-25", precioAcordado: "5000.00" });
    expect(res.body.pagos[0]).toMatchObject({ monto: "5000.00", metodo: "TARJETA" });
  });

  it("caso 6: fechaInicio en el pasado que no se encima", async () => {
    const res = await api.post(CLIENTE.nuevo, cobro({ fechaInicio: "2026-06-01" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fechaInicio: "2026-06-01", fechaFin: "2026-06-30" });
  });

  it("caso 7: fechaInicio que se encima con una que cuenta → 409 con la fecha sugerida", async () => {
    const res = await api.post(CLIENTE.ana, cobro({ fechaInicio: "2026-11-15" }));

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: "Conflict",
      mensaje: "Se encima con la membresía del 2026-11-01 al 2026-11-30",
      fechaInicioSugerida: "2026-12-01",
    });
    expect(nuevasDe(CLIENTE.ana)).toHaveLength(0);
    expect(bd.bitacora).toHaveLength(0);
  });

  it("caso 8: se puede encimar con una cancelada o con el pago anulado: esas no cuentan", async () => {
    // Del 25 de nov al 24 de dic: pisa la cancelada (20 nov–19 dic) y la anulada (20 dic–19 ene)
    const res = await api.post(CLIENTE.luis, cobro({ fechaInicio: "2026-11-25" }));

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ fechaInicio: "2026-11-25", fechaFin: "2026-12-24" });
  });

  it.each([
    ["2025-11-25", "No puede ser de hace más de un año"],
    ["2027-01-26", "No puede ser de dentro de más de 60 días"],
    ["2026-02-30", "Debe ser una fecha válida con formato AAAA-MM-DD"],
    ["26/11/2026", "Debe ser una fecha válida con formato AAAA-MM-DD"],
  ])("caso 9: fechaInicio %s → 400", async (fechaInicio, mensaje) => {
    const res = await api.post(CLIENTE.nuevo, cobro({ fechaInicio }));

    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "fechaInicio", mensaje }]);
  });

  it("caso 9: los límites exactos (hace un año y dentro de 60 días) sí se aceptan", async () => {
    expect((await api.post(CLIENTE.nuevo, cobro({ fechaInicio: "2025-11-26" }))).status).toBe(201);
    expect((await api.post(CLIENTE.nuevo, cobro({ fechaInicio: "2027-01-25" }))).status).toBe(201);
  });

  it.each([
    [PLAN.retirado.id, "El plan ya no está a la venta"],
    [PLAN.ajeno.id, "El plan no existe"], // de otro gimnasio: igual que si no existiera
    ["a0000000-0000-4000-8000-0000000000ff", "El plan no existe"],
    ["no-es-uuid", "Debe ser un id válido"],
  ])("caso 10: planId %s → 400", async (planId, mensaje) => {
    const res = await api.post(CLIENTE.nuevo, cobro({ planId }));

    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "planId", mensaje }]);
    expect(bd.bitacora).toHaveLength(0);
  });

  it("caso 11: sin planId ni metodo, o con un metodo que no existe", async () => {
    const vacio = await api.post(CLIENTE.nuevo, {});
    expect(vacio.status).toBe(400);
    expect(vacio.body.detalles).toEqual([
      { campo: "planId", mensaje: "Es obligatorio" },
      { campo: "metodo", mensaje: "Es obligatorio" },
    ]);

    const bitcoin = await api.post(CLIENTE.nuevo, cobro({ metodo: "BITCOIN" }));
    expect(bitcoin.status).toBe(400);
    expect(bitcoin.body.detalles).toEqual([{ campo: "metodo", mensaje: "Debe ser EFECTIVO, TARJETA o TRANSFERENCIA" }]);
  });

  it("caso 12: el precio y quién cobra no pueden venir en el body", async () => {
    const res = await api.post(CLIENTE.nuevo, cobro({ precioAcordado: "1.00", monto: "1.00", registradoPorId: USUARIOS.dueno.id }));

    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([
      { campo: "precioAcordado", mensaje: "Campo no permitido" },
      { campo: "monto", mensaje: "Campo no permitido" },
      { campo: "registradoPorId", mensaje: "Campo no permitido" },
    ]);
    expect(nuevasDe(CLIENTE.nuevo)).toHaveLength(0);
  });

  it.each([
    ["de otro gimnasio", CLIENTE.ajeno],
    ["bloqueado", CLIENTE.bloqueado],
    ["que no es UUID", "123"],
  ])("caso 13: cliente %s → 404, y no se crea nada", async (_caso, clienteId) => {
    const res = await api.post(clienteId, cobro());

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
    expect(bd.bitacora).toHaveLength(0);
  });

  it("caso 14: escribe dos filas CREAR en la bitácora: la membresía y el pago", async () => {
    const res = await api.post(CLIENTE.nuevo, cobro({ metodo: "TRANSFERENCIA" }));

    expect(bd.bitacora).toEqual([
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.recepcion.id,
        accion: "CREAR",
        entidad: "membresias",
        entidadId: res.body.id,
        datosDespues: { clienteId: CLIENTE.nuevo, planId: PLAN.mensual.id, fechaInicio: HOY, fechaFin: "2026-12-25", precioAcordado: "500.00" },
      },
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.recepcion.id,
        accion: "CREAR",
        entidad: "pagos",
        entidadId: res.body.pagos[0].id,
        datosDespues: { membresiaId: res.body.id, monto: "500.00", metodo: "TRANSFERENCIA", folio: null },
      },
    ]);
  });
});

describe("GET /clientes/:clienteId/membresias", () => {
  it("caso 15: historial de la más reciente a la más vieja, con su estado", async () => {
    const res = await api.get(CLIENTE.ana);

    expect(res.status).toBe(200);
    expect(res.body.estado).toEqual({ estado: "POR_VENCER", diasRestantes: 4, fechaFin: "2026-11-30", membresiaId: expect.any(String) });
    expect(res.body.data.map((m: { fechaInicio: string }) => m.fechaInicio)).toEqual(["2026-11-01", "2026-10-01"]);
    expect(res.body.data[0]).toMatchObject({ plan: { nombre: "Mensual" }, cuenta: true, pagos: [{ estado: "VALIDO" }] });
  });

  it("caso 15: marca con cuenta=false las canceladas y las de pago anulado; el estado ignora ambas", async () => {
    const res = await api.get(CLIENTE.luis);

    expect(res.body.estado).toMatchObject({ estado: "VENCIDO", diasRestantes: -10, fechaFin: "2026-11-16" });
    expect(res.body.data.map((m: { fechaInicio: string; cuenta: boolean }) => [m.fechaInicio, m.cuenta])).toEqual([
      ["2026-12-20", false],
      ["2026-11-20", false],
      ["2026-10-17", true],
    ]);
  });

  it("caso 16: cliente sin membresías", async () => {
    const res = await api.get(CLIENTE.nuevo);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: { estado: "SIN_MEMBRESIA", diasRestantes: null, fechaFin: null, membresiaId: null }, data: [] });
  });

  it.each([
    ["de otro gimnasio", CLIENTE.ajeno],
    ["bloqueado", CLIENTE.bloqueado],
    ["que no es UUID", "abc"],
  ])("caso 17: cliente %s → 404", async (_caso, clienteId) => {
    const res = await api.get(clienteId);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
  });
});

describe("todas las rutas", () => {
  it("caso 18: Cache-Control: no-store, también en los errores", async () => {
    for (const res of [await api.get(CLIENTE.ana), await api.post(CLIENTE.nuevo, cobro()), await api.get(CLIENTE.ajeno), await request(prueba.app).get(url(CLIENTE.ana))]) {
      expect(res.headers["cache-control"]).toBe("no-store");
    }
  });

  it("caso 19: sin token → 401", async () => {
    expect((await request(prueba.app).get(url(CLIENTE.ana))).status).toBe(401);
    expect((await request(prueba.app).post(url(CLIENTE.ana)).send(cobro())).status).toBe(401);
  });

  it("DUENO también puede cobrar, y queda como quien registró el pago", async () => {
    const tokenDueno = await firmarToken(claves, { sub: USUARIOS.dueno.id });
    const res = await request(prueba.app).post(url(CLIENTE.nuevo)).set("Authorization", `Bearer ${tokenDueno}`).send(cobro());

    expect(res.status).toBe(201);
    expect(res.body.pagos[0].registradoPor).toEqual({ id: USUARIOS.dueno.id, nombre: USUARIOS.dueno.nombre });
  });
});

describe("caso 5: ¿cuándo termina un mes? (calcularFechaFin)", () => {
  it.each([
    ["2026-11-26", 1, "2026-12-25"],
    ["2026-12-01", 1, "2026-12-31"],
    ["2026-03-31", 1, "2026-04-30"],
    ["2026-01-31", 1, "2026-02-28"],
    ["2028-01-30", 1, "2028-02-29"],
    ["2026-11-26", 12, "2027-11-25"],
    ["2026-12-15", 2, "2027-02-14"], // cruza de año
    ["2026-08-31", 6, "2027-02-28"], // cruza de año y cae en un día que no existe
  ])("%s + %i mes(es) → %s", (inicio, meses, fin) => {
    expect(calcularFechaFin(inicio, meses)).toBe(fin);
  });
});

// ─── Spec 0007: anulación de pagos ────────────────────────────────────────────
describe("POST /pagos/:id/anulacion (spec 0007)", () => {
  let tokenDueno: string;
  let tokenAdmin: string;
  beforeAll(async () => {
    tokenDueno = await firmarToken(claves, { sub: USUARIOS.dueno.id });
    tokenAdmin = await firmarToken(claves, { sub: USUARIOS.admin.id });
  });

  const anular = (pagoId: string, body: unknown, token = tokenDueno) =>
    request(prueba.app).post(`/pagos/${pagoId}/anulacion`).set("Authorization", `Bearer ${token}`).send(body as object);

  /** El pago de la membresía de Ana que vence el 30 (la única que cuenta para su estado). */
  const pagoVigenteDeAna = () => bd.filas.find((m) => m.clienteId === CLIENTE.ana && m.fechaFin === "2026-11-30")!.pagos[0]!;
  const pagoAnuladoDeLuis = () => bd.filas.find((m) => m.clienteId === CLIENTE.luis && m.fechaInicio === "2026-12-20")!.pagos[0]!;
  const pagoAjeno = () => bd.filas.find((m) => m.clienteId === CLIENTE.ajeno)!.pagos[0]!;

  it("1 y 12. DUENO anula: 200 con la membresía (pago ANULADO, cuenta=false) y una fila ANULAR_PAGO en la bitácora", async () => {
    const pago = pagoVigenteDeAna();
    const res = await anular(pago.id, { motivo: "  Cobro   duplicado " });

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({ fechaInicio: "2026-11-01", fechaFin: "2026-11-30", cuenta: false });
    expect(res.body.pagos).toEqual([
      expect.objectContaining({
        id: pago.id,
        estado: "ANULADO",
        anulacion: { anuladoEn: AHORA.toISOString(), anuladoPor: { id: USUARIOS.dueno.id, nombre: USUARIOS.dueno.nombre }, motivo: "Cobro duplicado" },
      }),
    ]);
    expect(bd.bitacora).toEqual([
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.dueno.id,
        accion: "ANULAR_PAGO",
        entidad: "pagos",
        entidadId: pago.id,
        datosAntes: { estado: "VALIDO" },
        datosDespues: { estado: "ANULADO", motivo: "Cobro duplicado" },
      },
    ]);
  });

  it("2. ADMIN también puede anular", async () => {
    expect((await anular(pagoVigenteDeAna().id, { motivo: "Plan equivocado" }, tokenAdmin)).status).toBe(200);
  });

  it("3. RECEPCION → 403 y el pago no cambia", async () => {
    const res = await anular(pagoVigenteDeAna().id, { motivo: "Cobro duplicado" }, tokenRecepcion);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
    expect(pagoVigenteDeAna().estado).toBe("VALIDO");
    expect(bd.bitacora).toEqual([]);
  });

  it.each([
    ["sin motivo", {}, "Es obligatorio"],
    ["motivo vacío", { motivo: "" }, "Es obligatorio"],
    ["motivo de solo espacios", { motivo: "   " }, "Es obligatorio"],
    ["motivo que no es texto", { motivo: 5 }, "Debe ser texto"],
    ["motivo de 201 caracteres", { motivo: "x".repeat(201) }, "Debe tener como máximo 200 caracteres"],
  ])("4 y 5. %s → 400 en motivo", async (_caso, body, mensaje) => {
    const res = await anular(pagoVigenteDeAna().id, body);
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "motivo", mensaje }]);
    expect(pagoVigenteDeAna().estado).toBe("VALIDO");
  });

  it("6. un campo extra (estado, anuladoPor…) → 400", async () => {
    const res = await anular(pagoVigenteDeAna().id, { motivo: "Cobro duplicado", anuladoPorId: USUARIOS.recepcion.id });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "anuladoPorId", mensaje: "Campo no permitido" }]);
  });

  it.each([
    ["de otro gimnasio", () => pagoAjeno().id],
    ["que no existe", () => "b0000000-0000-4000-8000-000000000123"],
    ["que no es UUID", () => "abc"],
  ])("7. un pago %s → 404", async (_caso, id) => {
    const res = await anular(id(), { motivo: "Cobro duplicado" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
    expect(pagoAjeno().estado).toBe("VALIDO");
  });

  it("8. el pago de un cliente bloqueado → 404", async () => {
    const membresiaDelBloqueado = membresia(CLIENTE.bloqueado, "2026-11-01", "2026-11-30");
    bd.filas.push(membresiaDelBloqueado);
    const res = await anular(membresiaDelBloqueado.pagos[0]!.id, { motivo: "Cobro duplicado" });
    expect(res.status).toBe(404);
  });

  it("9. un pago ya anulado → 409", async () => {
    const res = await anular(pagoAnuladoDeLuis().id, { motivo: "Otra vez" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Conflict", mensaje: "El pago ya está anulado" });
    expect(pagoAnuladoDeLuis().anulacion?.motivo).toBe("Cobro duplicado"); // no se sobrescribe
  });

  it("10 y 11. después de anular, esa membresía deja de contar: cambia el estado y la fecha sugerida para cobrar", async () => {
    await anular(pagoVigenteDeAna().id, { motivo: "Cobro duplicado" });

    // Su otra membresía (octubre) ya venció: Ana pasa de POR_VENCER a VENCIDO.
    const historial = await api.get(CLIENTE.ana);
    expect(historial.body.estado).toMatchObject({ estado: "VENCIDO", fechaFin: "2026-10-31" });

    // Al cobrar de nuevo, empieza hoy (y no el 1 de diciembre): el periodo anulado quedó libre.
    const cobroNuevo = await api.post(CLIENTE.ana, cobro());
    expect(cobroNuevo.status).toBe(201);
    expect(cobroNuevo.body.fechaInicio).toBe(HOY);
  });

  it("17. el motivo no va a los logs", async () => {
    await anular(pagoVigenteDeAna().id, { motivo: "Cobró a Marta 5512345678 por error" });
    await anular(pagoVigenteDeAna().id, { motivo: "Marta otra vez" }); // 409
    const logs = JSON.stringify([...prueba.logger.warn.mock.calls, ...prueba.logger.error.mock.calls]);
    expect(logs).not.toContain("Marta");
    expect(logs).not.toContain("5512345678");
  });
});
