// Tests de integración del repositorio REAL de reportes (spec 0008) contra Postgres.
// Cubren lo que el falso no puede probar: el día del gimnasio con AT TIME ZONE, los extremos
// del rango comparando instantes, sum() sobre numeric y el aislamiento por gimnasio.
// Ciudad de México está en UTC-6 todo el año (sin horario de verano desde 2022).
import { beforeEach, describe, expect, it } from "vitest";
import { aDate } from "../../src/lib/fechas.js";
import { createReporteRepository, type FilaIngresos } from "../../src/repositories/reporte.repository.js";
import { crearGimnasio, crearStaff, prisma } from "./db.js";

const repo = createReporteRepository(prisma);
const ZONA = "America/Mexico_City";

let mio: { id: string };
let ajeno: { id: string };
const membresiaDe: Record<string, string> = {};
const actorDe: Record<string, string> = {};

let telefono = 5520000000;
/** Un cliente con una membresía a la que se cuelgan los pagos del test. */
async function preparar(gimnasioId: string) {
  actorDe[gimnasioId] = (await crearStaff(gimnasioId, { rol: "DUENO" })).id;
  const { id: clienteId } = await prisma.cliente.create({
    data: { gimnasioId, nombres: "Cliente", apellidos: "Reporte", telefono: String(telefono++), fechaInscripcion: aDate("2026-01-10") },
  });
  const { id: planId } = await prisma.plan.create({ data: { gimnasioId, nombre: "Mensual", precio: "500.00", duracionMeses: 1 } });
  const { id } = await prisma.membresia.create({
    data: {
      gimnasioId,
      clienteId,
      planId,
      fechaInicio: aDate("2026-03-01"),
      fechaFin: aDate("2026-03-31"),
      precioAcordado: "500.00",
      creadaPorId: actorDe[gimnasioId]!,
    },
  });
  membresiaDe[gimnasioId] = id;
}

async function pago(gimnasioId: string, fechaPago: string, monto: string, metodo: FilaIngresos["metodo"] = "EFECTIVO", anulado = false) {
  const actor = actorDe[gimnasioId]!;
  await prisma.pago.create({
    data: {
      gimnasioId,
      membresiaId: membresiaDe[gimnasioId]!,
      fechaPago: new Date(fechaPago),
      monto,
      metodo,
      registradoPorId: actor,
      ...(anulado && { estado: "ANULADO", anuladoEn: new Date(), anuladoPorId: actor, motivoAnulacion: "Prueba" }),
    },
  });
}

beforeEach(async () => {
  [mio, ajeno] = await Promise.all([crearGimnasio(), crearGimnasio()]);
  await Promise.all([preparar(mio.id), preparar(ajeno.id)]);
});

const rango = (desde: string, hasta: string) => ({ desde, hasta, zonaHoraria: ZONA });

describe("ingresos", () => {
  it("caso 14: un pago a las 11:30 p. m. de CDMX cuenta en ESE día, aunque en UTC ya sea el siguiente", async () => {
    await pago(mio.id, "2026-03-11T05:30:00Z", "500.00"); // 10 de marzo, 23:30 en CDMX

    expect(await repo.ingresos(mio.id, rango("2026-03-01", "2026-03-31"))).toEqual([
      { fecha: "2026-03-10", metodo: "EFECTIVO", estado: "VALIDO", total: "500.00", pagos: 1 },
    ]);
  });

  it("caso 15: los dos extremos del rango se incluyen, al segundo; lo de fuera no", async () => {
    await pago(mio.id, "2026-03-10T05:59:59Z", "1.00"); // 9 mar 23:59:59 CDMX → fuera
    await pago(mio.id, "2026-03-10T06:00:00Z", "2.00"); // 10 mar 00:00:00 CDMX → dentro (primer instante)
    await pago(mio.id, "2026-03-13T05:59:59Z", "4.00"); // 12 mar 23:59:59 CDMX → dentro (último instante)
    await pago(mio.id, "2026-03-13T06:00:00Z", "8.00"); // 13 mar 00:00:00 CDMX → fuera

    expect(await repo.ingresos(mio.id, rango("2026-03-10", "2026-03-12"))).toEqual([
      { fecha: "2026-03-10", metodo: "EFECTIVO", estado: "VALIDO", total: "2.00", pagos: 1 },
      { fecha: "2026-03-12", metodo: "EFECTIVO", estado: "VALIDO", total: "4.00", pagos: 1 },
    ]);
  });

  it("agrupa por día, método y estado; sum() de numeric da el texto exacto (0.10 + 0.20 = 0.30)", async () => {
    await pago(mio.id, "2026-03-05T18:00:00Z", "0.10", "TARJETA");
    await pago(mio.id, "2026-03-05T19:00:00Z", "0.20", "TARJETA");
    await pago(mio.id, "2026-03-05T20:00:00Z", "500.00", "EFECTIVO");
    await pago(mio.id, "2026-03-05T21:00:00Z", "500.00", "EFECTIVO", true);

    expect(await repo.ingresos(mio.id, rango("2026-03-01", "2026-03-31"))).toEqual([
      { fecha: "2026-03-05", metodo: "EFECTIVO", estado: "ANULADO", total: "500.00", pagos: 1 },
      { fecha: "2026-03-05", metodo: "EFECTIVO", estado: "VALIDO", total: "500.00", pagos: 1 },
      { fecha: "2026-03-05", metodo: "TARJETA", estado: "VALIDO", total: "0.30", pagos: 2 },
    ]);
  });

  it("caso 16: nunca suma pagos de otro gimnasio (y desde el otro, no ve los míos)", async () => {
    await pago(mio.id, "2026-03-05T18:00:00Z", "100.00");
    await pago(ajeno.id, "2026-03-05T18:00:00Z", "999.00");

    expect(await repo.ingresos(mio.id, rango("2026-03-01", "2026-03-31"))).toEqual([
      { fecha: "2026-03-05", metodo: "EFECTIVO", estado: "VALIDO", total: "100.00", pagos: 1 },
    ]);
    expect((await repo.ingresos(ajeno.id, rango("2026-03-01", "2026-03-31"))).map((f) => f.total)).toEqual(["999.00"]);
  });
});
