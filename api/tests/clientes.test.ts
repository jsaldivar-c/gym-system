// Tests de la spec 0004 (docs/specs/0004-api-clientes.md). Cada `it` es un caso de la tabla.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ClienteRepository } from "../src/repositories/cliente.repository.js";
import type { EstadoCliente } from "../src/repositories/membresia.repository.js";
import { crearClienteRepositoryFalso, type FilaCliente, SIN_MEMBRESIA } from "./fakes/cliente-repository.fake.js";
import { crearAppDePrueba, crearClaves, firmarToken, GIMNASIO, OTRO_GIMNASIO, USUARIOS } from "./helpers.js";

const ID = {
  ana: "c0000000-0000-4000-8000-000000000001",
  luis: "c0000000-0000-4000-8000-000000000002",
  anaRuiz: "c0000000-0000-4000-8000-000000000003",
  bloqueado: "c0000000-0000-4000-8000-000000000004",
  ajeno: "c0000000-0000-4000-8000-000000000099",
};

/** 26 de noviembre a las 7:30 p. m. en la Ciudad de México… pero ya 27 en UTC. */
const AHORA = new Date("2026-11-27T01:30:00Z");
const HOY = "2026-11-26";

const vacio = {
  email: null,
  fechaNacimiento: null,
  contactoEmergenciaNombre: null,
  contactoEmergenciaTelefono: null,
  contactoEmergenciaParentesco: null,
  notas: null,
};

function fila(id: string, nombres: string, apellidos: string, telefono: string, extra: Partial<FilaCliente> = {}): FilaCliente {
  return { id, gimnasioId: GIMNASIO.id, estadoRegistro: "ACTIVO", nombres, apellidos, telefono, fechaInscripcion: "2026-01-10", ...vacio, ...extra };
}

/** Datos de partida: 3 clientes activos y 1 bloqueado en GIMNASIO, y 1 en OTRO_GIMNASIO. */
function clientesIniciales(): FilaCliente[] {
  return [
    fila(ID.anaRuiz, "Ana", "Ruiz Soto", "3312345000"),
    fila(ID.ana, "Ana", "López García", "5512345678", {
      email: "ana@mail.com",
      fechaNacimiento: "1990-05-14",
      contactoEmergenciaNombre: "Luis López",
      contactoEmergenciaTelefono: "5587654321",
      contactoEmergenciaParentesco: "Hermano",
    }),
    fila(ID.luis, "Luis", "López Pérez", "5587654321"),
    fila(ID.bloqueado, "Beto", "Aaa Bloqueado", "5500000001", { estadoRegistro: "BLOQUEADO" }),
    fila(ID.ajeno, "Carla", "Ajena", "5599999999", { gimnasioId: OTRO_GIMNASIO.id }),
  ];
}

let claves: Awaited<ReturnType<typeof crearClaves>>;
let tokenRecepcion: string;

beforeAll(async () => {
  claves = await crearClaves();
  tokenRecepcion = await firmarToken(claves, { sub: USUARIOS.recepcion.id });
});

let bd: ReturnType<typeof crearClienteRepositoryFalso>;
let prueba: ReturnType<typeof crearAppDePrueba>;
beforeEach(() => {
  bd = crearClienteRepositoryFalso(clientesIniciales());
  prueba = crearAppDePrueba({ keys: claves.jwks, clienteRepository: bd.repo, ahora: () => AHORA });
});

const conToken = (req: request.Test) => req.set("Authorization", `Bearer ${tokenRecepcion}`);
const api = {
  get: (url: string) => conToken(request(prueba.app).get(url)),
  post: (body: unknown) => conToken(request(prueba.app).post("/clientes")).send(body as object),
  patch: (id: string, body: unknown) => conToken(request(prueba.app).patch(`/clientes/${id}`)).send(body as object),
};

const campos = (res: request.Response) => (res.body.detalles as { campo: string }[]).map((d) => d.campo);
const nombres = (res: request.Response) => (res.body.data as { nombres: string; apellidos: string }[]).map((c) => `${c.nombres} ${c.apellidos}`);

const minimo = { nombres: "Marta", apellidos: "Díaz", telefono: "4421234567" };

describe("GET /clientes", () => {
  it("1. RECEPCION ve los clientes de su gimnasio, ordenados por apellidos, con meta", async () => {
    const res = await api.get("/clientes");
    expect(res.status).toBe(200);
    expect(nombres(res)).toEqual(["Ana López García", "Luis López Pérez", "Ana Ruiz Soto"]);
    expect(res.body.meta).toEqual({ pagina: 1, porPagina: 20, total: 3 });
  });

  it("2. nunca incluye clientes de otro gimnasio (ni en data ni en el total)", async () => {
    const res = await api.get("/clientes?porPagina=100");
    expect(JSON.stringify(res.body)).not.toContain("Carla");
    expect(res.body.meta.total).toBe(3);
  });

  it("3. ?buscar=LÓP encuentra López sin distinguir mayúsculas", async () => {
    expect(nombres(await api.get(`/clientes?buscar=${encodeURIComponent("LÓP")}`))).toEqual(["Ana López García", "Luis López Pérez"]);
  });

  it("3b. sin acento no lo encuentra (limitación aceptada: pregunta abierta 3 de la spec)", async () => {
    expect(nombres(await api.get("/clientes?buscar=lopez"))).toEqual([]);
  });

  it("4. ?buscar=ana lóp exige todas las palabras", async () => {
    expect(nombres(await api.get(`/clientes?buscar=${encodeURIComponent("ana lóp")}`))).toEqual(["Ana López García"]);
  });

  it("5. ?buscar=1234 busca en el teléfono (también con separadores)", async () => {
    expect(nombres(await api.get("/clientes?buscar=1234"))).toEqual(["Ana López García", "Ana Ruiz Soto"]);
    expect(bd.llamadas.listar.at(-1)?.busqueda).toEqual({ telefono: "1234" });
    await api.get("/clientes?buscar=55-1234");
    expect(bd.llamadas.listar.at(-1)?.busqueda).toEqual({ telefono: "551234" });
  });

  it("6. ?buscar=% busca el carácter literal: sin resultados", async () => {
    const res = await api.get("/clientes?buscar=%25");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("7. ?pagina=2&porPagina=2 devuelve la segunda página y el total sin paginar", async () => {
    const res = await api.get("/clientes?pagina=2&porPagina=2");
    expect(nombres(res)).toEqual(["Ana Ruiz Soto"]);
    expect(res.body.meta).toEqual({ pagina: 2, porPagina: 2, total: 3 });
  });

  it.each([
    ["porPagina=500", "porPagina"],
    ["porPagina=0", "porPagina"],
    ["pagina=0", "pagina"],
    ["pagina=abc", "pagina"],
    ["pagina=1.5", "pagina"],
    [`buscar=${"x".repeat(101)}`, "buscar"],
  ])("8. ?%s → 400 en %s", async (query, campo) => {
    const res = await api.get(`/clientes?${query}`);
    expect(res.status).toBe(400);
    expect(campos(res)).toEqual([campo]);
  });

  it("9. no incluye clientes BLOQUEADO (tampoco en el total)", async () => {
    const res = await api.get("/clientes");
    expect(JSON.stringify(res.body)).not.toContain("Bloqueado");
    expect(res.body.meta.total).toBe(3);
  });
});

describe("GET /clientes/:id", () => {
  it("10. un cliente propio → 200, con fechas YYYY-MM-DD y opcionales en null", async () => {
    const res = await api.get(`/clientes/${ID.ana}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: ID.ana,
      nombres: "Ana",
      apellidos: "López García",
      telefono: "5512345678",
      email: "ana@mail.com",
      fechaNacimiento: "1990-05-14",
      fechaInscripcion: "2026-01-10",
      contactoEmergencia: { nombre: "Luis López", telefono: "5587654321", parentesco: "Hermano" },
      notas: null,
      estado: SIN_MEMBRESIA, // spec 0006
    });
    const sinContacto = await api.get(`/clientes/${ID.luis}`);
    expect(sinContacto.body).toMatchObject({ email: null, fechaNacimiento: null, contactoEmergencia: null, notas: null });
  });

  it.each([
    ["de otro gimnasio", ID.ajeno],
    ["bloqueado", ID.bloqueado],
    ["que no es UUID", "no-es-uuid"],
  ])("11. un cliente %s → 404", async (_caso, id) => {
    const res = await api.get(`/clientes/${id}`);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not Found" });
  });
});

describe("Cache-Control", () => {
  it("12. toda respuesta de /clientes lleva no-store, incluidos 401, 404 y 400", async () => {
    const respuestas = await Promise.all([
      api.get("/clientes"),
      api.get(`/clientes/${ID.ana}`),
      api.get(`/clientes/${ID.ajeno}`),
      api.post({}),
      request(prueba.app).get("/clientes"),
    ]);
    for (const res of respuestas) expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("POST /clientes", () => {
  it("13. RECEPCION con solo los obligatorios → 201, Location, hoy en la zona del gimnasio y CREAR en la bitácora", async () => {
    const res = await api.post(minimo);
    expect(res.status).toBe(201);
    expect(res.headers["location"]).toBe(`/clientes/${res.body.id}`);
    expect(res.body).toEqual({
      id: res.body.id,
      ...minimo,
      email: null,
      fechaNacimiento: null,
      fechaInscripcion: HOY, // no "2026-11-27", que es la fecha en UTC
      contactoEmergencia: null,
      notas: null,
    });
    expect(bd.bitacora).toEqual([
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.recepcion.id,
        accion: "CREAR",
        entidad: "clientes",
        entidadId: res.body.id,
        datosAntes: null,
        datosDespues: { ...minimo, ...vacio, fechaInscripcion: HOY },
      },
    ]);
  });

  it("14. todos los campos con formatos 'sucios' → 201 normalizado", async () => {
    const res = await api.post({
      nombres: "  María   José ",
      apellidos: " Díaz  Peña ",
      telefono: "(442) 123-4567",
      email: "  Maria.Jose@Mail.COM ",
      fechaNacimiento: "1995-02-28",
      fechaInscripcion: "2026-11-20",
      contactoEmergencia: { nombre: " Rosa Peña ", telefono: "+52 442 765 4321", parentesco: "Mamá" },
      notas: "  Prefiere la tarde ",
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      nombres: "María José",
      apellidos: "Díaz Peña",
      telefono: "4421234567",
      email: "maria.jose@mail.com",
      fechaNacimiento: "1995-02-28",
      fechaInscripcion: "2026-11-20",
      contactoEmergencia: { nombre: "Rosa Peña", telefono: "4427654321", parentesco: "Mamá" },
      notas: "Prefiere la tarde",
    });
  });

  it.each([
    ["4421234567"],
    ["442 123 4567"],
    ["442-123-4567"],
    ["(442) 123-4567"],
    ["+52 442 123 4567"],
    ["524421234567"],
    ["+521 442 123 4567"],
  ])("15. teléfono %j → se guarda 4421234567", async (telefono) => {
    const res = await api.post({ ...minimo, telefono });
    expect(res.status).toBe(201);
    expect(res.body.telefono).toBe("4421234567");
  });

  it.each([["1234"], ["+1 212 555 0100"], ["44-ABCD-4567"], [4421234567], [""]])("15. teléfono %j → 400 en telefono", async (telefono) => {
    const res = await api.post({ ...minimo, telefono });
    expect(res.status).toBe(400);
    expect(campos(res)).toEqual(["telefono"]);
  });

  it.each([
    ["email", "ana@"],
    ["email", "ana mail.com"],
    ["fechaNacimiento", "2026-11-27"], // mañana, en la zona del gimnasio
    ["fechaNacimiento", "1900-01-01"], // más de 120 años
    ["fechaNacimiento", "2026-02-30"], // no existe
    ["fechaNacimiento", "14/05/1990"],
    ["fechaInscripcion", "2026-11-27"],
    ["nombres", "x".repeat(81)],
    ["apellidos", "   "],
    ["notas", "x".repeat(501)],
  ])("16. %s = %j → 400 en ese campo", async (campo, valor) => {
    const res = await api.post({ ...minimo, [campo]: valor });
    expect(res.status).toBe(400);
    expect(campos(res)).toEqual([campo]);
  });

  it("16b. varios errores a la vez → todos en detalles, con mensajes en español", async () => {
    const res = await api.post({ nombres: "", telefono: "123", email: "x" });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: "Bad Request",
      detalles: [
        { campo: "nombres", mensaje: "Es obligatorio" },
        { campo: "apellidos", mensaje: "Es obligatorio" },
        { campo: "telefono", mensaje: "Debe ser un teléfono de 10 dígitos" },
        { campo: "email", mensaje: "No es un email válido" },
      ],
    });
  });

  it("16c. opcionales vacíos (\"\" o null) se guardan como null", async () => {
    const res = await api.post({ ...minimo, email: "", notas: "  ", fechaNacimiento: null, contactoEmergencia: null });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: null, notas: null, fechaNacimiento: null, contactoEmergencia: null });
  });

  it("17. contactoEmergencia.telefono inválido → 400 en contactoEmergencia.telefono", async () => {
    const res = await api.post({ ...minimo, contactoEmergencia: { nombre: "Rosa", telefono: "123" } });
    expect(res.status).toBe(400);
    expect(campos(res)).toEqual(["contactoEmergencia.telefono"]);
  });

  it.each([["gimnasioId"], ["estadoRegistro"], ["id"]])("18. un campo extra (%s) → 400 y no se crea nada", async (extra) => {
    const res = await api.post({ ...minimo, [extra]: "x" });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: extra, mensaje: "Campo no permitido" }]);
    expect(bd.filas).toHaveLength(5);
  });

  it("18b. un campo extra dentro de contactoEmergencia → 400 con su ruta", async () => {
    const res = await api.post({ ...minimo, contactoEmergencia: { nombre: "Rosa", edad: 50 } });
    expect(res.body.detalles).toEqual([{ campo: "contactoEmergencia.edad", mensaje: "Campo no permitido" }]);
  });

  it("19. un teléfono que ya existe, escrito en otro formato → 409 con el clienteId", async () => {
    const res = await api.post({ ...minimo, telefono: "+52 (55) 1234-5678" });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Conflict", mensaje: "Ya existe un cliente con el teléfono 5512345678", clienteId: ID.ana });
    expect(bd.filas).toHaveLength(5);
  });

  it("20. un teléfono que existe solo en otro gimnasio → 201", async () => {
    expect((await api.post({ ...minimo, telefono: "5599999999" })).status).toBe(201);
  });
});

describe("PATCH /clientes/:id", () => {
  it("21. cambiar solo el email → 200, y la bitácora guarda solo email antes y después", async () => {
    const res = await api.patch(ID.ana, { email: "Ana.Nueva@Mail.com" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("ana.nueva@mail.com");
    expect(bd.bitacora).toEqual([
      {
        gimnasioId: GIMNASIO.id,
        actorId: USUARIOS.recepcion.id,
        accion: "ACTUALIZAR",
        entidad: "clientes",
        entidadId: ID.ana,
        datosAntes: { email: "ana@mail.com" },
        datosDespues: { email: "ana.nueva@mail.com" },
      },
    ]);
  });

  it("22. { email: null } → 200 y el email queda vacío", async () => {
    const res = await api.patch(ID.ana, { email: null });
    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();
  });

  it.each([["telefono"], ["nombres"], ["fechaInscripcion"]])("23. { %s: null } → 400 (es obligatorio)", async (campo) => {
    const res = await api.patch(ID.ana, { [campo]: null });
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo, mensaje: "Es obligatorio" }]);
  });

  it("24. el mismo teléfono en otro formato → 200 sin registro en la bitácora", async () => {
    const res = await api.patch(ID.ana, { telefono: "(55) 1234-5678", nombres: " Ana " });
    expect(res.status).toBe(200);
    expect(bd.bitacora).toHaveLength(0);
  });

  it("24b. contactoEmergencia se reemplaza completo; con null se borran los tres", async () => {
    const parcial = await api.patch(ID.ana, { contactoEmergencia: { nombre: "Rosa" } });
    expect(parcial.body.contactoEmergencia).toEqual({ nombre: "Rosa", telefono: null, parentesco: null });
    expect(bd.bitacora[0]?.datosDespues).toEqual({
      contactoEmergenciaNombre: "Rosa",
      contactoEmergenciaTelefono: null,
      contactoEmergenciaParentesco: null,
    });

    const borrado = await api.patch(ID.ana, { contactoEmergencia: null });
    expect(borrado.body.contactoEmergencia).toBeNull();
  });

  it("25. body vacío → 400", async () => {
    const res = await api.patch(ID.ana, {});
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "body", mensaje: "Envía al menos un campo para cambiar" }]);
  });

  it("26. un cliente de otro gimnasio → 404 y NO cambia", async () => {
    const res = await api.patch(ID.ajeno, { nombres: "Hackeado" });
    expect(res.status).toBe(404);
    expect(bd.filas.find((f) => f.id === ID.ajeno)?.nombres).toBe("Carla");
    expect(bd.bitacora).toHaveLength(0);
  });

  it("27. un teléfono que ya usa otro cliente → 409 con su clienteId", async () => {
    const res = await api.patch(ID.luis, { telefono: "55 1234 5678" });
    expect(res.status).toBe(409);
    expect(res.body.clienteId).toBe(ID.ana);
  });
});

describe("Rutas que no existen y autenticación", () => {
  it("28. DELETE /clientes/:id → 404 y no se borra nada", async () => {
    expect((await conToken(request(prueba.app).delete(`/clientes/${ID.ana}`))).status).toBe(404);
    expect(bd.filas).toHaveLength(5);
  });

  it.each([
    ["get", "/clientes"],
    ["get", `/clientes/${ID.ana}`],
    ["post", "/clientes"],
    ["patch", `/clientes/${ID.ana}`],
  ] as const)("29. %s %s sin token → 401", async (metodo, url) => {
    expect((await request(prueba.app)[metodo](url)).status).toBe(401);
  });
});

describe("31. Los datos personales no van a los logs", () => {
  const llamadasDelLogger = () => JSON.stringify([...prueba.logger.warn.mock.calls, ...prueba.logger.error.mock.calls]);

  it("búsquedas, altas, conflictos y errores de validación no escriben datos personales", async () => {
    await api.get("/clientes?buscar=ana%20lop");
    await api.post({ ...minimo, telefono: "5512345678" });
    await api.post({ ...minimo, email: "marta@" });
    await api.patch(ID.ana, { email: "ana2@mail.com" });

    const logs = llamadasDelLogger();
    for (const dato of ["ana", "lop", "5512345678", "Marta", "marta@", "ana2@mail.com"]) expect(logs).not.toContain(dato);
  });

  it("un error de Prisma (su mensaje puede traer los datos de la consulta) → 500 y el log no lleva el mensaje", async () => {
    const errorDePrisma = Object.assign(new Error("Invalid `prisma.cliente.create()` invocation: { telefono: '4421234567', nombres: 'Marta' }"), {
      name: "PrismaClientValidationError",
    });
    const repoQueFalla: ClienteRepository = { ...bd.repo, crear: () => Promise.reject(errorDePrisma) };
    prueba = crearAppDePrueba({ keys: claves.jwks, clienteRepository: repoQueFalla, ahora: () => AHORA });

    const res = await api.post(minimo);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal Server Error" });
    expect(prueba.logger.error).toHaveBeenCalledOnce();
    expect(llamadasDelLogger()).toContain("PrismaClientValidationError");
    expect(llamadasDelLogger()).not.toContain("4421234567");
    expect(llamadasDelLogger()).not.toContain("Marta");
  });
});

// ─── Spec 0006: el semáforo en la lista y en la ficha ─────────────────────────
describe("Spec 0006: estado en /clientes", () => {
  const POR_VENCER: EstadoCliente = { estado: "POR_VENCER", diasRestantes: 3, fechaFin: "2026-11-29", membresiaId: "m0000000-0000-4000-8000-000000000001" };
  const VENCIDO: EstadoCliente = { estado: "VENCIDO", diasRestantes: -5, fechaFin: "2026-11-21", membresiaId: "m0000000-0000-4000-8000-000000000002" };
  const ACTIVO: EstadoCliente = { estado: "ACTIVO", diasRestantes: 20, fechaFin: "2026-12-16", membresiaId: "m0000000-0000-4000-8000-000000000003" };

  // Ana López: por vencer · Luis López: vencido · Ana Ruiz: sin membresía · Carla (otro gimnasio): vencida
  beforeEach(() => {
    bd = crearClienteRepositoryFalso(clientesIniciales(), { [ID.ana]: POR_VENCER, [ID.luis]: VENCIDO, [ID.ajeno]: VENCIDO });
    prueba = crearAppDePrueba({ keys: claves.jwks, clienteRepository: bd.repo, ahora: () => AHORA });
  });

  const estados = (res: request.Response) => (res.body.data as { estado: EstadoCliente }[]).map((c) => c.estado.estado);

  it("1 y 2. cada cliente de la lista trae su estado; sin membresías → SIN_MEMBRESIA con nulls", async () => {
    const res = await api.get("/clientes");
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string; estado: EstadoCliente }) => [c.id, c.estado])).toEqual([
      [ID.ana, POR_VENCER],
      [ID.luis, VENCIDO],
      [ID.anaRuiz, SIN_MEMBRESIA],
    ]);
  });

  it("3. ?estado=VENCIDO → solo los vencidos de MI gimnasio, y el total cuenta solo esos", async () => {
    const res = await api.get("/clientes?estado=VENCIDO");
    expect(nombres(res)).toEqual(["Luis López Pérez"]);
    expect(res.body.meta.total).toBe(1);
    expect(bd.llamadas.listar.at(-1)?.estado).toBe("VENCIDO");
  });

  it("4. ?estado + ?buscar: se cumplen las dos condiciones", async () => {
    expect(nombres(await api.get(`/clientes?estado=POR_VENCER&buscar=${encodeURIComponent("lóp")}`))).toEqual(["Ana López García"]);
    expect(nombres(await api.get(`/clientes?estado=SIN_MEMBRESIA&buscar=${encodeURIComponent("lóp")}`))).toEqual([]);
  });

  it("5. pagina sobre lo filtrado", async () => {
    bd = crearClienteRepositoryFalso(clientesIniciales(), { [ID.ana]: ACTIVO, [ID.luis]: ACTIVO, [ID.anaRuiz]: ACTIVO });
    prueba = crearAppDePrueba({ keys: claves.jwks, clienteRepository: bd.repo, ahora: () => AHORA });
    const res = await api.get("/clientes?estado=ACTIVO&pagina=2&porPagina=1");
    expect(nombres(res)).toEqual(["Luis López Pérez"]);
    expect(res.body.meta).toEqual({ pagina: 2, porPagina: 1, total: 3 });
    expect(estados(res)).toEqual(["ACTIVO"]);
  });

  it.each(["vencido", "OTRO", "ACTIVO,VENCIDO"])("6. ?estado=%s → 400 en estado", async (valor) => {
    const res = await api.get(`/clientes?estado=${valor}`);
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "estado", mensaje: "Debe ser ACTIVO, POR_VENCER, VENCIDO o SIN_MEMBRESIA" }]);
  });

  it("7. ?estado= vacío → sin filtro", async () => {
    const res = await api.get("/clientes?estado=");
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(3);
    expect(bd.llamadas.listar.at(-1)?.estado).toBeUndefined();
  });

  it("8. la ficha (GET /clientes/:id) trae su estado", async () => {
    const res = await api.get(`/clientes/${ID.luis}`);
    expect(res.status).toBe(200);
    expect(res.body.estado).toEqual(VENCIDO);
  });

  it("9. POST y PATCH responden SIN estado (no consultan la vista)", async () => {
    const creado = await api.post(minimo);
    expect(creado.status).toBe(201);
    expect(creado.body).not.toHaveProperty("estado");
    const editado = await api.patch(ID.ana, { notas: "Prefiere turno matutino" });
    expect(editado.status).toBe(200);
    expect(editado.body).not.toHaveProperty("estado");
  });
});
