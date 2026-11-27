// Repositorio de membresías y pagos: la única capa que los consulta con Prisma.
// REGLA (ADR 0005): cada método recibe el gimnasioId y lo pone en el WHERE. Sin excepción.
import type { Prisma, PrismaClient } from "../generated/prisma/client.js";
import { aDate, deDate } from "../lib/fechas.js";

export type MetodoPago = "EFECTIVO" | "TARJETA" | "TRANSFERENCIA";
export type Estado = "ACTIVO" | "POR_VENCER" | "VENCIDO" | "SIN_MEMBRESIA";

export interface Pago {
  id: string;
  monto: string;
  metodo: MetodoPago;
  folio: string | null;
  estado: "VALIDO" | "ANULADO";
  fechaPago: string;
  registradoPor: { id: string; nombre: string };
  /** Quién, cuándo y por qué se anuló (spec 0007). null si el pago es válido. */
  anulacion: { anuladoEn: string; anuladoPor: { id: string; nombre: string }; motivo: string } | null;
}

/** Lo que puede pasar al anular (spec 0007). El servicio lo traduce a 200, 404 o 409. */
export type ResultadoAnulacion = { tipo: "anulado"; membresia: Membresia } | { tipo: "no-existe" } | { tipo: "ya-anulado" };

export interface Membresia {
  id: string;
  plan: { id: string; nombre: string };
  fechaInicio: string;
  fechaFin: string;
  precioAcordado: string;
  canceladaEn: string | null;
  /** ¿Cuenta para el estado? No cancelada y con al menos un pago válido (la regla de la vista). */
  cuenta: boolean;
  pagos: Pago[];
}

/** Un periodo ya ocupado por una membresía que cuenta. */
export interface Periodo {
  fechaInicio: string;
  fechaFin: string;
}

/** Lo que el servicio decide guardar: la membresía y su pago (el precio ya viene del plan). */
export interface NuevaMembresia {
  planId: string;
  fechaInicio: string;
  fechaFin: string;
  precio: string;
  metodo: MetodoPago;
  folio: string | null;
}

/** Una fila de la vista v_estado_clientes. */
export interface EstadoCliente {
  estado: Estado;
  diasRestantes: number | null;
  fechaFin: string | null;
  membresiaId: string | null;
}

export interface MembresiaRepository {
  /**
   * Bloquea al cliente (FOR UPDATE), le pasa a `planificar` los periodos que cuentan y guarda
   * lo que devuelva, con su pago y la bitácora, en UNA transacción. Si `planificar` lanza un
   * error, no se guarda nada. Devuelve null si el cliente no está activo en ESE gimnasio.
   */
  contratar(gimnasioId: string, clienteId: string, actorId: string, planificar: (ocupados: Periodo[]) => NuevaMembresia): Promise<Membresia | null>;
  /** Todas las membresías del cliente, de la más reciente a la más vieja. */
  historial(gimnasioId: string, clienteId: string): Promise<Membresia[]>;
  /** El estado según la vista, o null si el cliente no existe o no está activo en ESE gimnasio. */
  estado(gimnasioId: string, clienteId: string): Promise<EstadoCliente | null>;
  /**
   * Marca el pago como ANULADO y escribe la bitácora, en UNA transacción (spec 0007).
   * "no-existe" si el pago no es de ESE gimnasio o su cliente no está activo.
   */
  anularPago(gimnasioId: string, pagoId: string, actorId: string, motivo: string): Promise<ResultadoAnulacion>;
}

/** Las membresías que cuentan: la misma condición que la vista v_estado_clientes. */
const QUE_CUENTAN = { canceladaEn: null, pagos: { some: { estado: "VALIDO" } } } as const satisfies Prisma.MembresiaWhereInput;

const SELECT = {
  id: true,
  fechaInicio: true,
  fechaFin: true,
  precioAcordado: true,
  canceladaEn: true,
  plan: { select: { id: true, nombre: true } },
  pagos: {
    select: {
      id: true,
      monto: true,
      metodo: true,
      folio: true,
      estado: true,
      fechaPago: true,
      registradoPor: { select: { id: true, nombre: true } },
      anuladoEn: true,
      anuladoPor: { select: { id: true, nombre: true } },
      motivoAnulacion: true,
    },
    orderBy: { fechaPago: "asc" },
  },
} as const satisfies Prisma.MembresiaSelect;

type Fila = Prisma.MembresiaGetPayload<{ select: typeof SELECT }>;

function aMembresia({ fechaInicio, fechaFin, precioAcordado, canceladaEn, pagos, ...resto }: Fila): Membresia {
  return {
    ...resto,
    fechaInicio: deDate(fechaInicio),
    fechaFin: deDate(fechaFin),
    precioAcordado: precioAcordado.toFixed(2),
    canceladaEn: canceladaEn?.toISOString() ?? null,
    cuenta: canceladaEn === null && pagos.some((p) => p.estado === "VALIDO"),
    pagos: pagos.map(aPago),
  };
}

function aPago({ monto, fechaPago, anuladoEn, anuladoPor, motivoAnulacion, ...pago }: Fila["pagos"][number]): Pago {
  // El CHECK pagos_anulacion_coherente_chk garantiza que los tres datos vienen juntos o ninguno.
  const anulacion = anuladoEn && anuladoPor && motivoAnulacion ? { anuladoEn: anuladoEn.toISOString(), anuladoPor, motivo: motivoAnulacion } : null;
  return { ...pago, monto: monto.toFixed(2), fechaPago: fechaPago.toISOString(), anulacion };
}

export function createMembresiaRepository(prisma: PrismaClient): MembresiaRepository {
  return {
    async contratar(gimnasioId, clienteId, actorId, planificar) {
      return prisma.$transaction(async (tx) => {
        // El candado: otra transacción que quiera cobrarle a ESTE cliente espera aquí hasta nuestro COMMIT.
        // $queryRaw con template: los ${} viajan como parámetros ($1, $2), nunca pegados al SQL.
        const cliente = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM clientes
          WHERE id = ${clienteId}::uuid AND gimnasio_id = ${gimnasioId}::uuid AND estado_registro = 'ACTIVO'
          FOR UPDATE`;
        if (cliente.length === 0) return null;

        // Se leen DESPUÉS del candado: así vemos lo que guardó quien lo tenía antes.
        const ocupados = await tx.membresia.findMany({
          where: { gimnasioId, clienteId, ...QUE_CUENTAN },
          select: { fechaInicio: true, fechaFin: true },
          orderBy: { fechaInicio: "asc" },
        });
        const nueva = planificar(ocupados.map((o) => ({ fechaInicio: deDate(o.fechaInicio), fechaFin: deDate(o.fechaFin) })));

        const { id: membresiaId } = await tx.membresia.create({
          data: {
            gimnasioId,
            clienteId,
            planId: nueva.planId,
            fechaInicio: aDate(nueva.fechaInicio),
            fechaFin: aDate(nueva.fechaFin),
            precioAcordado: nueva.precio, // texto → Decimal: sin pasar nunca por float
            creadaPorId: actorId,
          },
          select: { id: true },
        });
        const { id: pagoId } = await tx.pago.create({
          data: { gimnasioId, membresiaId, monto: nueva.precio, metodo: nueva.metodo, folio: nueva.folio, registradoPorId: actorId },
          select: { id: true },
        });

        await tx.bitacoraAuditoria.createMany({
          data: [
            {
              gimnasioId,
              actorId,
              accion: "CREAR",
              entidad: "membresias",
              entidadId: membresiaId,
              datosDespues: { clienteId, planId: nueva.planId, fechaInicio: nueva.fechaInicio, fechaFin: nueva.fechaFin, precioAcordado: nueva.precio },
            },
            {
              gimnasioId,
              actorId,
              accion: "CREAR",
              entidad: "pagos",
              entidadId: pagoId,
              datosDespues: { membresiaId, monto: nueva.precio, metodo: nueva.metodo, folio: nueva.folio },
            },
          ],
        });

        return aMembresia(await tx.membresia.findFirstOrThrow({ where: { id: membresiaId, gimnasioId }, select: SELECT }));
      });
    },

    async anularPago(gimnasioId, pagoId, actorId, motivo) {
      return prisma.$transaction(async (tx) => {
        // Solo pagos de ESTE gimnasio cuyo cliente está activo (un bloqueado no existe para la API).
        const pago = await tx.pago.findFirst({
          where: { id: pagoId, gimnasioId, membresia: { cliente: { estadoRegistro: "ACTIVO" } } },
          select: { membresiaId: true },
        });
        if (!pago) return { tipo: "no-existe" };

        // La condición estado = VALIDO va DENTRO del UPDATE: es atómico. Si otra petición lo anuló
        // primero, Postgres nos hace esperar a su COMMIT, vuelve a evaluar el WHERE y aquí count = 0.
        const { count } = await tx.pago.updateMany({
          where: { id: pagoId, gimnasioId, estado: "VALIDO" },
          data: { estado: "ANULADO", anuladoEn: new Date(), anuladoPorId: actorId, motivoAnulacion: motivo },
        });
        if (count === 0) return { tipo: "ya-anulado" };

        await tx.bitacoraAuditoria.create({
          data: {
            gimnasioId,
            actorId,
            accion: "ANULAR_PAGO",
            entidad: "pagos",
            entidadId: pagoId,
            datosAntes: { estado: "VALIDO" },
            datosDespues: { estado: "ANULADO", motivo },
          },
        });

        const membresia = await tx.membresia.findFirstOrThrow({ where: { id: pago.membresiaId, gimnasioId }, select: SELECT });
        return { tipo: "anulado", membresia: aMembresia(membresia) };
      });
    },

    async historial(gimnasioId, clienteId) {
      const filas = await prisma.membresia.findMany({
        where: { gimnasioId, clienteId },
        orderBy: [{ fechaInicio: "desc" }, { createdAt: "desc" }],
        select: SELECT,
      });
      return filas.map(aMembresia);
    },

    async estado(gimnasioId, clienteId) {
      // ::text y ::int para recibir siempre texto "YYYY-MM-DD" y un número, sin conversiones de zona horaria.
      const filas = await prisma.$queryRaw<
        { estado: Estado; dias_restantes: number | null; fecha_fin: string | null; membresia_id: string | null }[]
      >`
        SELECT estado, dias_restantes::int AS dias_restantes, fecha_fin::text AS fecha_fin, membresia_id
        FROM v_estado_clientes
        WHERE cliente_id = ${clienteId}::uuid AND gimnasio_id = ${gimnasioId}::uuid`;
      const fila = filas[0];
      if (!fila) return null;
      return { estado: fila.estado, diasRestantes: fila.dias_restantes, fechaFin: fila.fecha_fin, membresiaId: fila.membresia_id };
    },
  };
}
