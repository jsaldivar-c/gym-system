// Tests de integración del repositorio REAL de clientes (specs 0004 y 0006) contra Postgres.
// Cubren lo que el repositorio falso no puede probar: el filtro por gimnasio y por estado en las
// consultas de Prisma, la búsqueda real con ILIKE (y sus comodines), el UNIQUE(gimnasio_id, telefono),
// las columnas `date` y el rollback de la transacción con la bitácora.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthContext } from "../../src/auth/roles.js";
import { ConflictError } from "../../src/errors.js";
import { aDate, hoyEn, sumarDias } from "../../src/lib/fechas.js";
import { createClienteRepository, type CamposCliente, type Cliente } from "../../src/repositories/cliente.repository.js";
import { createClienteService } from "../../src/services/cliente.service.js";
import { bitacoraDe, crearGimnasio, crearStaff, prisma } from "./db.js";

const repo = createClienteRepository(prisma);
const SIN_MEMBRESIA = { estado: "SIN_MEMBRESIA", diasRestantes: null, fechaFin: null, membresiaId: null };

const vacio = {
  email: null,
  fechaNacimiento: null,
  contactoEmergenciaNombre: null,
  contactoEmergenciaTelefono: null,
  contactoEmergenciaParentesco: null,
  notas: null,
};

const campos = (nombres: string, apellidos: string, telefono: string, extra: Partial<CamposCliente> = {}): CamposCliente => ({
  nombres,
  apellidos,
  telefono,
  fechaInscripcion: "2026-01-10",
  ...vacio,
  ...extra,
});

// Cada test arranca con DOS gimnasios nuevos: "mio" (el del usuario) y "ajeno" (el que nunca debe verse).
let mio: { id: string; nombre: string };
let ajeno: { id: string; nombre: string };
let actorId: string;
let ana: Cliente;
let luis: Cliente;
let anaRuiz: Cliente;
let bloqueadoId: string;
let ajenoId: string;

/** Inserta con Prisma directo (no con el repo) para no mezclar lo que se prueba con los datos de partida. */
async function insertar(gimnasioId: string, datos: CamposCliente, estado: "ACTIVO" | "BLOQUEADO" = "ACTIVO"): Promise<Cliente> {
  const { fechaNacimiento, fechaInscripcion, ...resto } = datos;
  const { id } = await prisma.cliente.create({
    data: {
      ...resto,
      gimnasioId,
      fechaInscripcion: new Date(`${fechaInscripcion}T00:00:00Z`),
      fechaNacimiento: fechaNacimiento ? new Date(`${fechaNacimiento}T00:00:00Z`) : null,
      estadoRegistro: estado,
      bloqueadoEn: estado === "BLOQUEADO" ? new Date() : null, // el CHECK lo exige
    },
  });
  return { id, ...datos };
}

beforeEach(async () => {
  [mio, ajeno] = await Promise.all([crearGimnasio(), crearGimnasio()]);
  actorId = (await crearStaff(mio.id)).id;

  [ana, luis, anaRuiz] = await Promise.all([
    insertar(mio.id, campos("Ana", "López García", "5512345678", { email: "ana@mail.com", fechaNacimiento: "1990-05-14" })),
    insertar(mio.id, campos("Luis", "López Pérez", "5587654321")),
    insertar(mio.id, campos("Ana", "Ruiz_Soto", "3312345000")), // el "_" sirve para probar los comodines
  ]);
  bloqueadoId = (await insertar(mio.id, campos("Beto", "Aaa Bloqueado", "5500000001"), "BLOQUEADO")).id;
  ajenoId = (await insertar(ajeno.id, campos("Carla", "López Ajena", "5599999999"))).id;
});

const pagina = { pagina: 1, porPagina: 20 };
const nombresDe = ({ clientes }: { clientes: Cliente[] }) => clientes.map((c) => `${c.nombres} ${c.apellidos}`);

describe("listar", () => {
  it("casos 1, 2 y 9: solo los activos del gimnasio pedido, ordenados por apellidos, y el total igual", async () => {
    const resultado = await repo.listar(mio.id, pagina);

    expect(nombresDe(resultado)).toEqual(["Ana López García", "Luis López Pérez", "Ana Ruiz_Soto"]);
    expect(resultado.total).toBe(3);
    expect(resultado.clientes.map((c) => c.id)).not.toContain(ajenoId);
    expect(resultado.clientes.map((c) => c.id)).not.toContain(bloqueadoId);
  });

  it("las fechas salen como YYYY-MM-DD, igual que se guardaron (la columna date no se mueve de día)", async () => {
    const { clientes } = await repo.listar(mio.id, pagina);
    expect(clientes[0]).toEqual({ ...ana, estado: SIN_MEMBRESIA });
  });

  it("caso 3: busca sin distinguir mayúsculas, y nunca en otro gimnasio", async () => {
    expect(nombresDe(await repo.listar(mio.id, { ...pagina, busqueda: { palabras: ["LÓP"] } }))).toEqual([
      "Ana López García",
      "Luis López Pérez",
    ]);
  });

  it("caso 4: cada palabra debe aparecer en nombres o en apellidos", async () => {
    expect(nombresDe(await repo.listar(mio.id, { ...pagina, busqueda: { palabras: ["ana", "lóp"] } }))).toEqual(["Ana López García"]);
  });

  it("caso 5: busca por parte del teléfono", async () => {
    expect(nombresDe(await repo.listar(mio.id, { ...pagina, busqueda: { telefono: "1234" } }))).toEqual([
      "Ana López García",
      "Ana Ruiz_Soto",
    ]);
  });

  it("caso 6: % y _ se buscan como texto, no como comodines de LIKE", async () => {
    // Como comodín, "%" encontraría a todos (3). Como texto, a nadie.
    expect((await repo.listar(mio.id, { ...pagina, busqueda: { palabras: ["%"] } })).total).toBe(0);
    // Como comodín, "_" ("cualquier carácter") también encontraría a todos. Como texto, solo a Ruiz_Soto.
    expect(nombresDe(await repo.listar(mio.id, { ...pagina, busqueda: { palabras: ["_"] } }))).toEqual(["Ana Ruiz_Soto"]);
  });

  it("caso 7: pagina, y el total cuenta todo lo que coincide", async () => {
    const segunda = await repo.listar(mio.id, { pagina: 2, porPagina: 2 });
    expect(nombresDe(segunda)).toEqual(["Ana Ruiz_Soto"]);
    expect(segunda.total).toBe(3);
  });
});

describe("buscarPorId", () => {
  it("encuentra un cliente propio", async () => {
    expect(await repo.buscarPorId(mio.id, ana.id)).toEqual(ana);
  });

  it("caso 11: de otro gimnasio, bloqueado o inexistente → null", async () => {
    expect(await repo.buscarPorId(mio.id, ajenoId)).toBeNull();
    expect(await repo.buscarPorId(mio.id, bloqueadoId)).toBeNull();
    expect(await repo.buscarPorId(mio.id, randomUUID())).toBeNull();
    // Desde su gimnasio sí existe: el null se debe al filtro, no a que el id esté mal.
    expect(await repo.buscarPorId(ajeno.id, ajenoId)).not.toBeNull();
  });
});

describe("buscarIdPorTelefono", () => {
  it("devuelve el id del dueño del teléfono, ignorando otros gimnasios y al propio cliente (excluirId)", async () => {
    expect(await repo.buscarIdPorTelefono(mio.id, "5512345678")).toBe(ana.id);
    expect(await repo.buscarIdPorTelefono(mio.id, "5599999999")).toBeNull();
    expect(await repo.buscarIdPorTelefono(mio.id, "5512345678", ana.id)).toBeNull();
  });
});

describe("crear", () => {
  it("caso 13: guarda el cliente y una fila CREAR en la bitácora, en el gimnasio correcto", async () => {
    const datos = campos("Marta", "Díaz", "4421234567", { fechaNacimiento: "2000-02-29", contactoEmergenciaNombre: "Rosa" });
    const cliente = await repo.crear(mio.id, datos, actorId);

    expect(cliente).toEqual({ id: cliente.id, ...datos });
    expect(await repo.buscarPorId(mio.id, cliente.id)).toEqual(cliente);

    const bitacora = await bitacoraDe(mio.id, cliente.id, "clientes");
    expect(bitacora).toHaveLength(1);
    expect(bitacora[0]).toMatchObject({ accion: "CREAR", actorId, datosAntes: null, datosDespues: datos });
  });

  it("caso 19 sin servicio: UNIQUE(gimnasio_id, telefono): aunque nadie llame al servicio, la BD lo rechaza → ConflictError", async () => {
    await expect(repo.crear(mio.id, campos("Otra", "Ana", "5512345678"), actorId)).rejects.toBeInstanceOf(ConflictError);
  });

  it("caso 19: el teléfono de un cliente BLOQUEADO también está ocupado (el UNIQUE no mira el estado)", async () => {
    await expect(repo.crear(mio.id, campos("Otro", "Beto", "5500000001"), actorId)).rejects.toBeInstanceOf(ConflictError);
  });

  it("caso 20: el mismo teléfono en otro gimnasio sí se permite", async () => {
    const cliente = await repo.crear(mio.id, campos("Carla", "Nueva", "5599999999"), actorId);
    expect(cliente.telefono).toBe("5599999999");
  });
});

describe("actualizar", () => {
  it("cambia el cliente y guarda en la bitácora lo que recibe, incluidas fechas y null", async () => {
    const cliente = await repo.actualizar(mio.id, ana.id, {
      actorId,
      antes: { email: "ana@mail.com", fechaNacimiento: "1990-05-14" },
      despues: { email: null, fechaNacimiento: "1991-12-31" },
    });

    expect(cliente).toEqual({ ...ana, email: null, fechaNacimiento: "1991-12-31" });
    const [fila] = await bitacoraDe(mio.id, ana.id, "clientes");
    expect(fila).toMatchObject({ accion: "ACTUALIZAR", datosAntes: { email: "ana@mail.com" }, datosDespues: { email: null } });
  });

  it("caso 26: un cliente de otro gimnasio devuelve null, NO cambia y no deja rastro", async () => {
    const resultado = await repo.actualizar(mio.id, ajenoId, { actorId, antes: { nombres: "Carla" }, despues: { nombres: "Hackeado" } });

    expect(resultado).toBeNull();
    expect((await repo.buscarPorId(ajeno.id, ajenoId))?.nombres).toBe("Carla");
    expect(await bitacoraDe(ajeno.id, ajenoId, "clientes")).toHaveLength(0);
  });

  it("un cliente bloqueado no se puede editar: null", async () => {
    expect(await repo.actualizar(mio.id, bloqueadoId, { actorId, antes: {}, despues: { notas: "x" } })).toBeNull();
  });

  it("caso 27 sin servicio: un teléfono ocupado → la BD lo frena y llega ConflictError", async () => {
    await expect(
      repo.actualizar(mio.id, luis.id, { actorId, antes: { telefono: luis.telefono }, despues: { telefono: ana.telefono } }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.buscarPorId(mio.id, luis.id)).toEqual(luis);
  });

  it("casos 21 y 24, servicio + repo real: la bitácora solo guarda lo que cambió, ya normalizado", async () => {
    const auth: AuthContext = {
      userId: actorId,
      gimnasioId: mio.id,
      rol: "RECEPCION",
      nombre: "Ana López",
      gimnasioNombre: mio.nombre,
      zonaHoraria: "America/Mexico_City",
    };
    const servicio = createClienteService(repo);

    await servicio.actualizar(auth, anaRuiz.id, { telefono: "3312345000", notas: "Viene en las mañanas" });

    const filas = await bitacoraDe(mio.id, anaRuiz.id, "clientes");
    expect(filas).toHaveLength(1);
    expect(filas[0]?.datosAntes).toEqual({ notas: null });
    expect(filas[0]?.datosDespues).toEqual({ notas: "Viene en las mañanas" });
  });
});

describe("caso 30: si falla la bitácora, se deshace todo (rollback)", () => {
  // Igual que en plan.repository.test.ts, pero con otros nombres: los archivos corren en paralelo.
  const SABOTEADOR = randomUUID();

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION test_bitacora_falla_clientes() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'bitácora caída (simulado por el test)'; END; $$`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_bitacora_falla_clientes BEFORE INSERT ON bitacora_auditoria
      FOR EACH ROW WHEN (NEW.actor_id = '${SABOTEADOR}'::uuid) EXECUTE FUNCTION test_bitacora_falla_clientes()`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS test_bitacora_falla_clientes ON bitacora_auditoria");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS test_bitacora_falla_clientes()");
  });

  it("crear: el cliente NO queda guardado", async () => {
    await expect(repo.crear(mio.id, campos("Fantasma", "Pérez", "4420000000"), SABOTEADOR)).rejects.toThrow(/bitácora caída/);
    expect(await repo.buscarIdPorTelefono(mio.id, "4420000000")).toBeNull();
  });

  it("actualizar: el cliente queda como estaba", async () => {
    await expect(repo.actualizar(mio.id, ana.id, { actorId: SABOTEADOR, antes: {}, despues: { nombres: "Fantasma" } })).rejects.toThrow(
      /bitácora caída/,
    );
    expect(await repo.buscarPorId(mio.id, ana.id)).toEqual(ana);
  });
});

// ─── Spec 0006: el semáforo sale de la vista v_estado_clientes ───────────────
describe("spec 0006: listar y buscarConEstado con el estado de la vista", () => {
  // La vista calcula "hoy" con now() de Postgres en la zona del gimnasio (por defecto, Ciudad de México).
  const hoy = hoyEn("America/Mexico_City");
  const dias = (n: number) => sumarDias(hoy, n);

  /** Una membresía con su pago VALIDO, insertada con Prisma directo. */
  async function membresia(gimnasioId: string, clienteId: string, fechaFin: string) {
    const { id: planId } = await prisma.plan.create({ data: { gimnasioId, nombre: "Mensual", precio: "500.00", duracionMeses: 1 } });
    const { id } = await prisma.membresia.create({
      data: { gimnasioId, clienteId, planId, fechaInicio: aDate(dias(-60)), fechaFin: aDate(fechaFin), precioAcordado: "500.00", creadaPorId: actorId },
    });
    await prisma.pago.create({ data: { gimnasioId, membresiaId: id, monto: "500.00", metodo: "EFECTIVO", registradoPorId: actorId } });
    return id;
  }

  let membresiaAna: string;
  let membresiaLuis: string;
  beforeEach(async () => {
    // Ana López: vence en 3 días (POR_VENCER, aviso por defecto de 7) · Luis: venció hace 5 · Ana Ruiz: sin membresía.
    membresiaAna = await membresia(mio.id, ana.id, dias(3));
    membresiaLuis = await membresia(mio.id, luis.id, dias(-5));
    await membresia(ajeno.id, ajenoId, dias(-5)); // vencida en OTRO gimnasio: nunca debe aparecer
  });

  it("casos 1, 2 y 10: cada cliente trae el estado calculado por la vista", async () => {
    const { clientes } = await repo.listar(mio.id, pagina);
    expect(clientes.map((c) => [c.nombres, c.estado])).toEqual([
      ["Ana", { estado: "POR_VENCER", diasRestantes: 3, fechaFin: dias(3), membresiaId: membresiaAna }],
      ["Luis", { estado: "VENCIDO", diasRestantes: -5, fechaFin: dias(-5), membresiaId: membresiaLuis }],
      ["Ana", SIN_MEMBRESIA],
    ]);
  });

  it("casos 3 y 12: ?estado filtra, cuenta solo eso y nunca trae otro gimnasio ni bloqueados", async () => {
    const vencidos = await repo.listar(mio.id, { ...pagina, estado: "VENCIDO" });
    expect(nombresDe(vencidos)).toEqual(["Luis López Pérez"]);
    expect(vencidos.total).toBe(1);
    expect((await repo.listar(mio.id, { ...pagina, estado: "SIN_MEMBRESIA" })).clientes.map((c) => c.id)).toEqual([anaRuiz.id]);
    expect((await repo.listar(mio.id, { ...pagina, estado: "ACTIVO" })).total).toBe(0);
  });

  it("caso 11: filtro + búsqueda + paginación juntos", async () => {
    expect(nombresDe(await repo.listar(mio.id, { ...pagina, estado: "POR_VENCER", busqueda: { palabras: ["lóp"] } }))).toEqual([
      "Ana López García",
    ]);
    expect((await repo.listar(mio.id, { ...pagina, estado: "VENCIDO", busqueda: { telefono: "1234" } })).total).toBe(0);
    const segunda = await repo.listar(mio.id, { pagina: 2, porPagina: 1, busqueda: { palabras: ["lóp"] } });
    expect(nombresDe(segunda)).toEqual(["Luis López Pérez"]);
    expect(segunda.total).toBe(2);
  });

  it("caso 8: buscarConEstado trae la ficha con su estado; ajeno, bloqueado o inexistente → null", async () => {
    expect(await repo.buscarConEstado(mio.id, luis.id)).toEqual({
      ...luis,
      estado: { estado: "VENCIDO", diasRestantes: -5, fechaFin: dias(-5), membresiaId: membresiaLuis },
    });
    expect(await repo.buscarConEstado(mio.id, ana.id)).toMatchObject({ ...ana, estado: { estado: "POR_VENCER" } });
    expect(await repo.buscarConEstado(mio.id, ajenoId)).toBeNull();
    expect(await repo.buscarConEstado(mio.id, bloqueadoId)).toBeNull();
    expect(await repo.buscarConEstado(mio.id, randomUUID())).toBeNull();
  });
});
