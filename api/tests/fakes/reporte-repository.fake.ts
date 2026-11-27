// Repositorio de reportes EN MEMORIA para los tests: agrupa una lista de pagos como lo haría el SQL
// (por día del gimnasio, método y estado; solo de ESE gimnasio y dentro del rango).
// La consulta real (AT TIME ZONE, extremos del rango, sum de numeric) se prueba en tests/integration/reporte.repository.test.ts.
import { hoyEn } from "../../src/lib/fechas.js";
import { aCentavos, deCentavos } from "../../src/lib/dinero.js";
import type { MetodoPago } from "../../src/repositories/membresia.repository.js";
import type { FilaIngresos, Rango, ReporteRepository } from "../../src/repositories/reporte.repository.js";

export interface PagoFalso {
  gimnasioId: string;
  fechaPago: string; // instante ISO, como timestamptz
  monto: string;
  metodo: MetodoPago;
  estado: "VALIDO" | "ANULADO";
}

export function crearReporteRepositoryFalso(pagos: PagoFalso[] = []) {
  const llamadas: { gimnasioId: string; rango: Rango }[] = [];

  const repo: ReporteRepository = {
    async ingresos(gimnasioId, rango) {
      llamadas.push({ gimnasioId, rango });
      const grupos = new Map<string, FilaIngresos & { centavos: bigint }>();
      for (const p of pagos) {
        const fecha = hoyEn(rango.zonaHoraria, new Date(p.fechaPago));
        if (p.gimnasioId !== gimnasioId || fecha < rango.desde || fecha > rango.hasta) continue;
        const llave = `${fecha}|${p.metodo}|${p.estado}`;
        const grupo = grupos.get(llave) ?? { fecha, metodo: p.metodo, estado: p.estado, total: "0.00", pagos: 0, centavos: 0n };
        grupo.centavos += aCentavos(p.monto);
        grupo.pagos += 1;
        grupos.set(llave, grupo);
      }
      return [...grupos.values()].map(({ centavos, ...fila }) => ({ ...fila, total: deCentavos(centavos) }));
    },
  };

  return { repo, llamadas };
}
