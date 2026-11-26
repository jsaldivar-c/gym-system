// Tests de la spec 0003 (docs/specs/0003-api-planes.md). Cada `it` es un caso de la tabla.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearPlanRepositoryFalso } from "./fakes/plan-repository.fake.js";
import { crearAppDePrueba, crearClaves, firmarToken, GIMNASIO, OTRO_GIMNASIO, USUARIOS } from "./helpers.js";

const ID = {
  mensual: "a0000000-0000-4000-8000-000000000001",
  trimestral: "a0000000-0000-4000-8000-000000000002",
  anualInactivo: "a0000000-0000-4000-8000-000000000003",
  ajeno: "a0000000-0000-4000-8000-000000000099",
};

/** Datos de partida: 3 planes en GIMNASIO y 1 en OTRO_GIMNASIO. */
function planesIniciales() {
  return [
    { id: ID.trimestral, gimnasioId: GIMNASIO.id, nombre: "Trimestral", precio: "1350.00", duracionMeses: 3, activo: true },
    { id: ID.mensual, gimnasioId: GIMNASIO.id, nombre: "Mensual", precio: "500.00", duracionMeses: 1, activo: true },
    { id: ID.anualInactivo, gimnasioId: GIMNASIO.id, nombre: "Anual 2025", precio: "4800.00", duracionMeses: 12, activo: false },
    { id: ID.ajeno, gimnasioId: OTRO_GIMNASIO.id, nombre: "Plan Secreto", precio: "999.00", duracionMeses: 1, activo: true },
  ];
}

let claves: Awaited<ReturnType<typeof crearClaves>>;
let tokenRecepcion: string;
let tokenDueno: string;

beforeAll(async () => {
  claves = await crearClaves();
  tokenRecepcion = await firmarToken(claves, { sub: USUARIOS.recepcion.id });
  tokenDueno = await firmarToken(claves, { sub: USUARIOS.dueno.id });
});

// Cada test empieza con datos limpios: los tests no deben depender unos de otros.
let bd: ReturnType<typeof crearPlanRepositoryFalso>;
let app: ReturnType<typeof crearAppDePrueba>["app"];
beforeEach(() => {
  bd = crearPlanRepositoryFalso(planesIniciales());
  app = crearAppDePrueba({ keys: claves.jwks, planRepository: bd.repo }).app;
});

const como = (token: string) => ({
  get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
  post: (url: string, body: unknown) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body as object),
  patch: (url: string, body: unknown) => request(app).patch(url).set("Authorization", `Bearer ${token}`).send(body as object),
  delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
});

const camposCon400 = (res: request.Response) => (res.body.detalles as { campo: string }[]).map((d) => d.campo);

describe("GET /planes", () => {
  it("1. RECEPCION ve solo los activos de su gimnasio, ordenados por duración", async () => {
    const res = await como(tokenRecepcion).get("/planes");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { nombre: string }) => p.nombre)).toEqual(["Mensual", "Trimestral"]);
    expect(res.body.data[0]).toEqual({ id: ID.mensual, nombre: "Mensual", precio: "500.00", duracionMeses: 1, activo: true });
  });

  it("2. ?incluirInactivos=true también trae los inactivos", async () => {
    const res = await como(tokenRecepcion).get("/planes?incluirInactivos=true");
    expect(res.body.data.map((p: { nombre: string }) => p.nombre)).toEqual(["Mensual", "Trimestral", "Anual 2025"]);
  });

  it("3. nunca incluye planes de otro gimnasio", async () => {
    const res = await como(tokenDueno).get("/planes?incluirInactivos=true");
    expect(JSON.stringify(res.body)).not.toContain("Plan Secreto");
  });
});

describe("GET /planes/:id", () => {
  it("4. un plan inactivo propio → 200", async () => {
    const res = await como(tokenRecepcion).get(`/planes/${ID.anualInactivo}`);
    expect(res.status).toBe(200);
    expect(res.body.activo).toBe(false);
  });

  it("5. un plan de otro gimnasio → 404 (no 403: no revela que existe)", async () => {
    const res = await como(tokenDueno).get(`/planes/${ID.ajeno}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
  });

  it("6. un id que no es UUID → 404", async () => {
    expect((await como(tokenDueno).get("/planes/no-es-uuid")).status).toBe(404);
  });
});

describe("POST /planes", () => {
  const valido = { nombre: "Semestral", precio: "2500.00", duracionMeses: 6 };

  it("7. DUENO con datos válidos → 201, Location, activo, y registro CREAR en la bitácora", async () => {
    const res = await como(tokenDueno).post("/planes", { ...valido, nombre: "  Semestral  ", precio: "2500.5" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: "Semestral", precio: "2500.50", duracionMeses: 6, activo: true });
    expect(res.headers["location"]).toBe(`/planes/${res.body.id}`);

    expect(bd.bitacora).toHaveLength(1);
    expect(bd.bitacora[0]).toMatchObject({
      gimnasioId: GIMNASIO.id,
      actorId: USUARIOS.dueno.id,
      accion: "CREAR",
      entidad: "planes",
      entidadId: res.body.id,
      datosAntes: null,
    });
  });

  it("8. RECEPCION → 403 y no se crea nada", async () => {
    const res = await como(tokenRecepcion).post("/planes", valido);
    expect(res.status).toBe(403);
    expect(bd.filas).toHaveLength(4);
  });

  it.each([["0"], ["0.00"], ["-5"], ["10.999"], ["abc"], [500], [""]])("9. precio %j → 400 en precio", async (precio) => {
    const res = await como(tokenDueno).post("/planes", { ...valido, precio });
    expect(res.status).toBe(400);
    expect(camposCon400(res)).toEqual(["precio"]);
  });

  it.each([[0], [25], [1.5], ["3"]])("10. duracionMeses %j → 400 en duracionMeses", async (duracionMeses) => {
    const res = await como(tokenDueno).post("/planes", { ...valido, duracionMeses });
    expect(res.status).toBe(400);
    expect(camposCon400(res)).toEqual(["duracionMeses"]);
  });

  it.each([[""], ["   "], ["x".repeat(61)]])("11. nombre %j → 400 en nombre", async (nombre) => {
    const res = await como(tokenDueno).post("/planes", { ...valido, nombre });
    expect(res.status).toBe(400);
    expect(camposCon400(res)).toEqual(["nombre"]);
  });

  it("12. varios errores a la vez → todos en detalles, con mensajes en español", async () => {
    const res = await como(tokenDueno).post("/planes", { nombre: "", precio: "0", duracionMeses: 30 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Bad Request",
      detalles: [
        { campo: "nombre", mensaje: "Es obligatorio" },
        { campo: "precio", mensaje: "Debe ser mayor que 0" },
        { campo: "duracionMeses", mensaje: "Debe estar entre 1 y 24" },
      ],
    });
  });

  it("13. un campo extra (gimnasioId) → 400 y no se crea nada (asignación masiva)", async () => {
    const res = await como(tokenDueno).post("/planes", { ...valido, gimnasioId: OTRO_GIMNASIO.id });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "gimnasioId", mensaje: "Campo no permitido" }]);
    expect(bd.filas).toHaveLength(4);
  });

  it("13b. un body que no es objeto → 400 en body", async () => {
    const res = await como(tokenDueno).post("/planes", [valido]);
    expect(res.status).toBe(400);
    expect(camposCon400(res)).toEqual(["body"]);
  });

  it('14. nombre repetido sin importar mayúsculas ni espacios (" mensual ") → 409', async () => {
    const res = await como(tokenDueno).post("/planes", { ...valido, nombre: " mensual " });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Conflict", mensaje: 'Ya existe un plan llamado "mensual"' });
  });

  it("15. un nombre que existe solo en otro gimnasio → 201", async () => {
    const res = await como(tokenDueno).post("/planes", { ...valido, nombre: "Plan Secreto" });
    expect(res.status).toBe(201);
  });
});

describe("PATCH /planes/:id", () => {
  it("16. cambiar solo el precio → 200, y la bitácora guarda solo precio antes y después", async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.mensual}`, { precio: "550" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: ID.mensual, nombre: "Mensual", precio: "550.00", duracionMeses: 1, activo: true });
    expect(bd.bitacora).toEqual([
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.dueno.id,
        accion: "ACTUALIZAR",
        entidad: "planes",
        entidadId: ID.mensual,
        datosAntes: { precio: "500.00" },
        datosDespues: { precio: "550.00" },
      },
    ]);
  });

  it("17. { activo: false } → deja de salir en GET /planes", async () => {
    expect((await como(tokenDueno).patch(`/planes/${ID.mensual}`, { activo: false })).status).toBe(200);
    const lista = await como(tokenRecepcion).get("/planes");
    expect(lista.body.data.map((p: { nombre: string }) => p.nombre)).toEqual(["Trimestral"]);
  });

  it("18. body vacío → 400", async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.mensual}`, {});
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "body", mensaje: "Envía al menos un campo para cambiar" }]);
  });

  it('19. los mismos valores ("500" = "500.00") → 200 sin registro en la bitácora', async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.mensual}`, { precio: "500", nombre: "Mensual" });
    expect(res.status).toBe(200);
    expect(bd.bitacora).toHaveLength(0);
  });

  it("20. un plan de otro gimnasio → 404 y el plan NO cambia", async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.ajeno}`, { precio: "1.00" });
    expect(res.status).toBe(404);
    expect(bd.filas.find((f) => f.id === ID.ajeno)?.precio).toBe("999.00");
    expect(bd.bitacora).toHaveLength(0);
  });

  it("21. RECEPCION → 403", async () => {
    expect((await como(tokenRecepcion).patch(`/planes/${ID.mensual}`, { precio: "1.00" })).status).toBe(403);
  });

  it("22. un nombre que ya usa otro plan → 409", async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.mensual}`, { nombre: "TRIMESTRAL" });
    expect(res.status).toBe(409);
  });

  it("22b. cambiar solo mayúsculas del propio nombre → 200 (no choca consigo mismo)", async () => {
    const res = await como(tokenDueno).patch(`/planes/${ID.mensual}`, { nombre: "MENSUAL" });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("MENSUAL");
  });
});

describe("Rutas que no existen y autenticación", () => {
  it("23. DELETE /planes/:id → 404", async () => {
    expect((await como(tokenDueno).delete(`/planes/${ID.mensual}`)).status).toBe(404);
    expect(bd.filas).toHaveLength(4);
  });

  it.each([
    ["get", "/planes"],
    ["get", `/planes/${ID.mensual}`],
    ["post", "/planes"],
    ["patch", `/planes/${ID.mensual}`],
  ] as const)("24. %s %s sin token → 401", async (metodo, url) => {
    expect((await request(app)[metodo](url)).status).toBe(401);
  });
});
