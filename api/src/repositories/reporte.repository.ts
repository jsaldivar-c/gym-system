// Repositorio de reportes (spec 0008): consultas de solo lectura que agregan datos.
// REGLA (ADR 0005): cada método recibe el gimnasioId y lo pone en el WHERE. Sin excepción.
import type { PrismaClient } from "../generated/prisma/client.js";
import type { MetodoPago } from "./membresia.repository.js";

/** Una fila agrupada: lo cobrado un día, con un método y en un estado. */
export interface FilaIngresos {
  fecha: string; // "YYYY-MM-DD", día del gimnasio
  metodo: MetodoPago;
  estado: "VALIDO" | "ANULADO";
  total: string; // "1500.00"
  pagos: number;
}

export interface Rango {
  desde: string;
  hasta: string;
  /** Zona IANA del gimnasio: define a qué día pertenece cada pago. */
  zonaHoraria: string;
}

export interface ReporteRepository {
  /** Los pagos del rango (extremos incluidos) agrupados por día, método y estado. */
  ingresos(gimnasioId: string, rango: Rango): Promise<FilaIngresos[]>;
}

export function createReporteRepository(prisma: PrismaClient): ReporteRepository {
  return {
    async ingresos(gimnasioId, { desde, hasta, zonaHoraria }) {
      // `timestamptz AT TIME ZONE zona` → la hora local del gimnasio; ::date → su día.
      // El WHERE compara fecha_pago contra INSTANTES (inicio de `desde` y del día después de `hasta`,
      // en la zona del gimnasio): así Postgres puede usar el índice (gimnasio_id, fecha_pago).
      // ::text en las sumas: el dinero llega como "1500.00", nunca como float.
      return prisma.$queryRaw<FilaIngresos[]>`
        SELECT (p.fecha_pago AT TIME ZONE ${zonaHoraria})::date::text AS fecha,
               p.metodo::text AS metodo,
               p.estado::text AS estado,
               sum(p.monto)::text AS total,
               count(*)::int AS pagos
        FROM pagos p
        WHERE p.gimnasio_id = ${gimnasioId}::uuid
          AND p.fecha_pago >= (${desde}::date::timestamp AT TIME ZONE ${zonaHoraria})
          AND p.fecha_pago < ((${hasta}::date + 1)::timestamp AT TIME ZONE ${zonaHoraria})
        GROUP BY 1, 2, 3
        ORDER BY 1, 2, 3`;
    },
  };
}
