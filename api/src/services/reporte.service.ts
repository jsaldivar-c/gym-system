// Servicio de reportes (spec 0008). No sabe nada de Express ni de Prisma.
import type { AuthContext } from "../auth/roles.js";
import { aCentavos, deCentavos } from "../lib/dinero.js";
import type { MetodoPago } from "../repositories/membresia.repository.js";
import type { FilaIngresos, ReporteRepository } from "../repositories/reporte.repository.js";
import type { IngresosQuery } from "../schemas/reporte.schema.js";

const METODOS: MetodoPago[] = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"];

export interface Suma {
  total: string;
  pagos: number;
}

export interface ReporteIngresos extends Suma {
  desde: string;
  hasta: string;
  porMetodo: (Suma & { metodo: MetodoPago })[];
  porDia: (Suma & { fecha: string })[];
  anulados: Suma;
}

export interface ReporteService {
  ingresos(auth: AuthContext, rango: IngresosQuery): Promise<ReporteIngresos>;
}

/** Un acumulador en centavos: se suma con BigInt y al final se vuelve texto. */
class Acumulado {
  centavos = 0n;
  pagos = 0;

  sumar(fila: FilaIngresos) {
    this.centavos += aCentavos(fila.total);
    this.pagos += fila.pagos;
  }

  get suma(): Suma {
    return { total: deCentavos(this.centavos), pagos: this.pagos };
  }
}

/** De las filas agrupadas (día × método × estado) al reporte. Función pura: fácil de probar. */
export function armarReporte(filas: FilaIngresos[], { desde, hasta }: IngresosQuery): ReporteIngresos {
  const validos = new Acumulado();
  const anulados = new Acumulado();
  const porMetodo = new Map(METODOS.map((m) => [m, new Acumulado()]));
  const porDia = new Map<string, Acumulado>();

  for (const fila of filas) {
    if (fila.estado === "ANULADO") {
      anulados.sumar(fila);
      continue;
    }
    validos.sumar(fila);
    porMetodo.get(fila.metodo)?.sumar(fila);
    const dia = porDia.get(fila.fecha) ?? new Acumulado();
    dia.sumar(fila);
    porDia.set(fila.fecha, dia);
  }

  return {
    desde,
    hasta,
    ...validos.suma,
    porMetodo: METODOS.map((metodo) => ({ metodo, ...(porMetodo.get(metodo) ?? new Acumulado()).suma })),
    // "YYYY-MM-DD" se ordena bien como texto
    porDia: [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fecha, acc]) => ({ fecha, ...acc.suma })),
    anulados: anulados.suma,
  };
}

export function createReporteService(repo: ReporteRepository): ReporteService {
  return {
    async ingresos(auth, rango) {
      const filas = await repo.ingresos(auth.gimnasioId, { ...rango, zonaHoraria: auth.zonaHoraria });
      return armarReporte(filas, rango);
    },
  };
}
