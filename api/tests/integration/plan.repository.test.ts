// Tests de integración del repositorio REAL de planes (spec 0003) contra Postgres.
// Cubren lo que el repositorio falso de tests/fakes/ no puede probar: las consultas de Prisma
// (filtro por gimnasio, ADR 0005), el índice único sobre lower(nombre), la bitácora y las transacciones.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AuthContext } from "../../src/auth/roles.js";
import { ConflictError } from "../../src/errors.js";
import { createPlanRepository, type Plan } from "../../src/repositories/plan.repository.js";
import { createPlanService } from "../../src/services/plan.service.js";
import { bitacoraDe, crearGimnasio, crearStaff, prisma } from "./db.js";

const repo = createPlanRepository(prisma);

// Cada test arranca con DOS gimnasios nuevos: "mio" (el del usuario) y "ajeno" (el que nunca debe verse).
let mio: { id: string; nombre: string };
let ajeno: { id: string; nombre: string };
let actorId: string;
let mensual: Plan;
let anualInactivo: Plan;
let planAjeno: Plan;

beforeEach(async () => {
  [mio, ajeno] = await Promise.all([crearGimnasio(), crearGimnasio()]);
  actorId = (await crearStaff(mio.id)).id;

  // Se insertan con Prisma directo (no con el repo) para no mezclar lo que se prueba con los datos de partida.
  const insertar = (gimnasioId: string, nombre: string, precio: string, duracionMeses: number, activo = true) =>
    prisma.plan.create({ data: { gimnasioId, nombre, precio, duracionMeses, activo } }).then((p) => p.id);

  const [idMensual, , idAnual, idAjeno] = await Promise.all([
    insertar(mio.id, "Mensual", "500", 1),
    insertar(mio.id, "Trimestral", "1350", 3),
    insertar(mio.id, "Anual 2025", "4800", 12, false),
    insertar(ajeno.id, "Plan Secreto", "999", 1),
  ]);
  mensual = { id: idMensual, nombre: "Mensual", precio: "500.00", duracionMeses: 1, activo: true };
  anualInactivo = { id: idAnual, nombre: "Anual 2025", precio: "4800.00", duracionMeses: 12, activo: false };
  planAjeno = { id: idAjeno, nombre: "Plan Secreto", precio: "999.00", duracionMeses: 1, activo: true };
});

describe("listar", () => {
  it("caso 3: solo devuelve planes del gimnasio pedido, activos y ordenados por duración", async () => {
    const planes = await repo.listar(mio.id, { incluirInactivos: false });

    expect(planes.map((p) => p.nombre)).toEqual(["Mensual", "Trimestral"]);
    expect(planes.map((p) => p.id)).not.toContain(planAjeno.id);
  });

  it("con incluirInactivos también trae los inactivos, pero nunca los de otro gimnasio", async () => {
    const planes = await repo.listar(mio.id, { incluirInactivos: true });

    expect(planes.map((p) => p.nombre)).toEqual(["Mensual", "Trimestral", "Anual 2025"]);
    expect(planes.map((p) => p.id)).not.toContain(planAjeno.id);
  });

  it("el precio sale como texto con 2 decimales (numeric de Postgres → string, nunca float)", async () => {
    const [primero] = await repo.listar(mio.id, { incluirInactivos: false });
    expect(primero).toEqual(mensual);
  });
});

describe("buscarPorId", () => {
  it("encuentra un plan propio, aunque esté inactivo", async () => {
    expect(await repo.buscarPorId(mio.id, anualInactivo.id)).toEqual(anualInactivo);
  });

  it("caso 5: un plan de otro gimnasio no existe para mí (null)", async () => {
    expect(await repo.buscarPorId(mio.id, planAjeno.id)).toBeNull();
    // Y desde su gimnasio sí existe: el null se debe al filtro, no a que el id esté mal.
    expect(await repo.buscarPorId(ajeno.id, planAjeno.id)).toEqual(planAjeno);
  });

  it("un id que no existe devuelve null", async () => {
    expect(await repo.buscarPorId(mio.id, randomUUID())).toBeNull();
  });
});

describe("existeNombre", () => {
  it("compara sin distinguir mayúsculas", async () => {
    expect(await repo.existeNombre(mio.id, "MENSUAL")).toBe(true);
  });

  it("un nombre usado solo en OTRO gimnasio está libre", async () => {
    expect(await repo.existeNombre(mio.id, "plan secreto")).toBe(false);
  });

  it("excluirId: un plan no choca consigo mismo (renombrar 'Mensual' a 'mensual')", async () => {
    expect(await repo.existeNombre(mio.id, "mensual", mensual.id)).toBe(false);
  });
});

describe("crear", () => {
  it("caso 7: guarda el plan activo y una fila CREAR en la bitácora, en el gimnasio correcto", async () => {
    const plan = await repo.crear(mio.id, { nombre: "Semestral", precio: "2600.00", duracionMeses: 6 }, actorId);

    expect(plan).toMatchObject({ nombre: "Semestral", precio: "2600.00", duracionMeses: 6, activo: true });
    expect(await repo.buscarPorId(mio.id, plan.id)).toEqual(plan);

    const bitacora = await bitacoraDe(mio.id, plan.id);
    expect(bitacora).toHaveLength(1);
    expect(bitacora[0]).toMatchObject({ accion: "CREAR", actorId, datosAntes: null, datosDespues: { ...plan } });
  });

  it("caso 14 sin servicio: índice único lower(nombre): aunque nadie llame al servicio, la BD rechaza 'mensual' → ConflictError", async () => {
    await expect(repo.crear(mio.id, { nombre: "mensual", precio: "1.00", duracionMeses: 1 }, actorId)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("caso 15: el mismo nombre en otro gimnasio sí se permite (el índice es por gimnasio)", async () => {
    const plan = await repo.crear(ajeno.id, { nombre: "Mensual", precio: "450.00", duracionMeses: 1 }, actorId);
    expect(plan.nombre).toBe("Mensual");
  });
});

describe("actualizar", () => {
  it("cambia el plan y guarda en la bitácora lo que recibe (antes y después)", async () => {
    const plan = await repo.actualizar(mio.id, mensual.id, { actorId, antes: { precio: "500.00" }, despues: { precio: "550.00" } });

    expect(plan).toEqual({ ...mensual, precio: "550.00" });
    const [fila] = await bitacoraDe(mio.id, mensual.id);
    expect(fila).toMatchObject({ accion: "ACTUALIZAR", actorId, datosAntes: { precio: "500.00" }, datosDespues: { precio: "550.00" } });
  });

  it("caso 20: un plan de otro gimnasio devuelve null, NO cambia y no deja rastro en la bitácora", async () => {
    const resultado = await repo.actualizar(mio.id, planAjeno.id, {
      actorId,
      antes: { nombre: "Plan Secreto" },
      despues: { nombre: "Hackeado" },
    });

    expect(resultado).toBeNull();
    expect(await repo.buscarPorId(ajeno.id, planAjeno.id)).toEqual(planAjeno);
    expect(await bitacoraDe(ajeno.id, planAjeno.id)).toHaveLength(0);
    expect(await bitacoraDe(mio.id, planAjeno.id)).toHaveLength(0);
  });

  it("caso 22 sin servicio: renombrar a un nombre ocupado → la BD lo frena y llega ConflictError", async () => {
    await expect(
      repo.actualizar(mio.id, mensual.id, { actorId, antes: { nombre: "Mensual" }, despues: { nombre: "TRIMESTRAL" } }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.buscarPorId(mio.id, mensual.id)).toEqual(mensual);
  });

  it("caso 16, servicio + repo real: la bitácora solo guarda los campos que de verdad cambiaron", async () => {
    const auth: AuthContext = { userId: actorId, gimnasioId: mio.id, rol: "DUENO", nombre: "Ana López", gimnasioNombre: mio.nombre, zonaHoraria: "America/Mexico_City" };
    const servicio = createPlanService(repo);

    // El nombre y la duración llegan iguales a los actuales; solo el precio cambia.
    await servicio.actualizar(auth, mensual.id, { nombre: "Mensual", precio: "600.00", duracionMeses: 1 });

    const filas = await bitacoraDe(mio.id, mensual.id);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.datosAntes).toEqual({ precio: "500.00" });
    expect(filas[0]?.datosDespues).toEqual({ precio: "600.00" });
  });

  it("caso 19, servicio + repo real: con los mismos valores no se escribe nada en la bitácora", async () => {
    const auth: AuthContext = { userId: actorId, gimnasioId: mio.id, rol: "DUENO", nombre: "Ana López", gimnasioNombre: mio.nombre, zonaHoraria: "America/Mexico_City" };

    await createPlanService(repo).actualizar(auth, mensual.id, { precio: "500.00", activo: true });

    expect(await bitacoraDe(mio.id, mensual.id)).toHaveLength(0);
  });
});

describe("caso 25: si falla la bitácora, se deshace todo (rollback)", () => {
  // Un "saboteador": un trigger que hace fallar el INSERT en la bitácora SOLO para este actor.
  // Así simulamos un error real de Postgres a mitad de la transacción sin afectar a otros tests.
  const SABOTEADOR = randomUUID();

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION test_bitacora_falla() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'bitácora caída (simulado por el test)'; END; $$`);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER test_bitacora_falla BEFORE INSERT ON bitacora_auditoria
      FOR EACH ROW WHEN (NEW.actor_id = '${SABOTEADOR}'::uuid) EXECUTE FUNCTION test_bitacora_falla()`);
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe("DROP TRIGGER IF EXISTS test_bitacora_falla ON bitacora_auditoria");
    await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS test_bitacora_falla()");
  });

  it("crear: el plan NO queda guardado", async () => {
    await expect(repo.crear(mio.id, { nombre: "Fantasma", precio: "100.00", duracionMeses: 1 }, SABOTEADOR)).rejects.toThrow(
      /bitácora caída/,
    );

    expect(await repo.existeNombre(mio.id, "Fantasma")).toBe(false);
  });

  it("actualizar: el plan queda como estaba", async () => {
    await expect(
      repo.actualizar(mio.id, mensual.id, { actorId: SABOTEADOR, antes: { precio: "500.00" }, despues: { precio: "1.00" } }),
    ).rejects.toThrow(/bitácora caída/);

    expect(await repo.buscarPorId(mio.id, mensual.id)).toEqual(mensual);
  });
});
