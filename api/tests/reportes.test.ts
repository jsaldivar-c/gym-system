// Tests de la spec 0008 (docs/specs/0008-api-reporte-ingresos.md). Cada `it` es un caso de la tabla.
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aCentavos, deCentavos } from "../src/lib/dinero.js";
import { crearReporteRepositoryFalso, type PagoFalso } from "./fakes/reporte-repository.fake.js";
import { crearAppDePrueba, crearClaves, firmarToken, GIMNASIO, OTRO_GIMNASIO, USUARIOS } from "./helpers.js";

/** 26 de noviembre a las 7:30 p. m. en la Ciudad de México… pero ya 27 en UTC. */
const AHORA = new Date("2026-11-27T01:30:00Z");

const pago = (fechaPago: string, monto: string, metodo: PagoFalso["metodo"], extra: Partial<PagoFalso> = {}): PagoFalso => ({
  gimnasioId: GIMNASIO.id,
  fechaPago,
  monto,
  metodo,
  estado: "VALIDO",
  ...extra,
});

const pagosIniciales = (): PagoFalso[] => [
  pago("2026-11-01T16:00:00Z", "500.00", "EFECTIVO"),
  pago("2026-11-01T18:00:00Z", "0.10", "TARJETA"),
  pago("2026-11-01T19:00:00Z", "0.20", "TARJETA"),
  pago("2026-11-03T05:30:00Z", "5000.00", "EFECTIVO"), // 2 de nov. a las 11:30 p. m. en CDMX
  pago("2026-11-10T17:00:00Z", "500.00", "EFECTIVO", { estado: "ANULADO" }),
  pago("2026-10-31T17:00:00Z", "500.00", "EFECTIVO"), // mes anterior: fuera del rango por defecto
  pago("2026-11-05T17:00:00Z", "999.00", "EFECTIVO", { gimnasioId: OTRO_GIMNASIO.id }),
];

let claves: Awaited<ReturnType<typeof crearClaves>>;
const tokens = { dueno: "", admin: "", recepcion: "" };

beforeAll(async () => {
  claves = await crearClaves();
  tokens.dueno = await firmarToken(claves, { sub: USUARIOS.dueno.id });
  tokens.admin = await firmarToken(claves, { sub: USUARIOS.admin.id });
  tokens.recepcion = await firmarToken(claves, { sub: USUARIOS.recepcion.id });
});

let bd: ReturnType<typeof crearReporteRepositoryFalso>;
let prueba: ReturnType<typeof crearAppDePrueba>;
beforeEach(() => {
  bd = crearReporteRepositoryFalso(pagosIniciales());
  prueba = crearAppDePrueba({ keys: claves.jwks, reporteRepository: bd.repo, ahora: () => AHORA });
});

const get = (query = "", token = tokens.dueno) => request(prueba.app).get(`/reportes/ingresos${query}`).set("Authorization", `Bearer ${token}`);
const campos = (res: request.Response) => (res.body.detalles as { campo: string; mensaje: string }[]).map((d) => d.campo);

describe("GET /reportes/ingresos", () => {
  it("1, 4, 5, 6, 7 y 8. DUENO sin parámetros: del 1 del mes a hoy (CDMX), solo válidos, anulados aparte, centavos exactos", async () => {
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      desde: "2026-11-01",
      hasta: "2026-11-26", // y no el 27, que ya es en UTC
      total: "5500.30",
      pagos: 4,
      porMetodo: [
        { metodo: "EFECTIVO", total: "5500.00", pagos: 2 },
        { metodo: "TARJETA", total: "0.30", pagos: 2 }, // 0.10 + 0.20, sin 0.30000000000000004
        { metodo: "TRANSFERENCIA", total: "0.00", pagos: 0 },
      ],
      porDia: [
        { fecha: "2026-11-01", total: "500.30", pagos: 3 },
        { fecha: "2026-11-02", total: "5000.00", pagos: 1 },
      ],
      anulados: { total: "500.00", pagos: 1 },
    });
    // El repositorio recibe el gimnasio y la zona del USUARIO, nunca de la petición.
    expect(bd.llamadas.at(-1)).toEqual({
      gimnasioId: GIMNASIO.id,
      rango: { desde: "2026-11-01", hasta: "2026-11-26", zonaHoraria: GIMNASIO.zonaHoraria },
    });
  });

  it("2. ADMIN también lo ve", async () => {
    expect((await get("", tokens.admin)).status).toBe(200);
  });

  it("3. RECEPCION → 403 y no consulta nada", async () => {
    const res = await get("", tokens.recepcion);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
    expect(bd.llamadas).toEqual([]);
  });

  it("un periodo sin pagos: todo en cero, porMetodo completo y porDia vacío", async () => {
    const res = await get("?desde=2026-09-01&hasta=2026-09-30");
    expect(res.body).toMatchObject({ total: "0.00", pagos: 0, porDia: [], anulados: { total: "0.00", pagos: 0 } });
    expect(res.body.porMetodo.map((m: { metodo: string }) => m.metodo)).toEqual(["EFECTIVO", "TARJETA", "TRANSFERENCIA"]);
  });

  it("9. hasta anterior a desde → 400 en hasta", async () => {
    const res = await get("?desde=2026-11-10&hasta=2026-11-09");
    expect(res.status).toBe(400);
    expect(res.body.detalles).toEqual([{ campo: "hasta", mensaje: "Debe ser igual o posterior a desde" }]);
  });

  it("9b. desde = hasta (un solo día) se permite", async () => {
    const res = await get("?desde=2026-11-01&hasta=2026-11-01");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe("500.30");
  });

  it("10. 367 días → 400; 366 (un año bisiesto completo) sí", async () => {
    const largo = await get("?desde=2027-01-01&hasta=2028-01-02");
    expect(largo.status).toBe(400);
    expect(largo.body.detalles).toEqual([{ campo: "hasta", mensaje: "El rango no puede ser de más de 366 días" }]);
    expect((await get("?desde=2028-01-01&hasta=2028-12-31")).status).toBe(200);
  });

  it.each([
    ["?desde=2026-02-30", "desde"],
    ["?desde=abc", "desde"],
    ["?hasta=2026-13-01", "hasta"],
    ["?desde=2026-11-01&desde=2026-11-02", "desde"], // dos valores: llega un arreglo, no un texto
  ])("11. %s → 400 en %s", async (query, campo) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(campos(res)).toEqual([campo]);
  });

  it("12. solo desde → hasta = hoy; solo hasta → desde = el 1 de ese mes; vacíos = no vinieron", async () => {
    expect((await get("?desde=2026-10-15")).body).toMatchObject({ desde: "2026-10-15", hasta: "2026-11-26" });
    expect((await get("?hasta=2026-10-20")).body).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-20" });
    expect((await get("?desde=&hasta=")).body).toMatchObject({ desde: "2026-11-01", hasta: "2026-11-26" });
  });

  it("13. Cache-Control: no-store, también en 401, 403 y 400", async () => {
    const respuestas = await Promise.all([
      get(),
      get("", tokens.recepcion),
      get("?desde=abc"),
      request(prueba.app).get("/reportes/ingresos"),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([200, 403, 400, 401]);
    for (const res of respuestas) expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("dinero en centavos (lib/dinero)", () => {
  it.each([
    ["0.10", 10n],
    ["1500", 150000n],
    ["1500.5", 150050n],
    ["99999999.99", 9999999999n],
  ])("%s → %s centavos, y de regreso", (monto, centavos) => {
    expect(aCentavos(monto)).toBe(centavos);
    expect(aCentavos(deCentavos(centavos))).toBe(centavos);
  });

  it("rechaza formatos que no son dinero", () => {
    for (const malo of ["", "abc", "1.234", "-5.00", "1e3"]) expect(() => aCentavos(malo)).toThrow();
  });
});
