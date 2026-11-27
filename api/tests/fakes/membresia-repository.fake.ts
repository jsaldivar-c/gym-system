// Repositorio de membresías EN MEMORIA para los tests: imita al real (filtro por gimnasio,
// solo clientes activos, "qué cuenta", bitácora) y la regla de la vista v_estado_clientes.
// La vista REAL, el FOR UPDATE y el rollback se prueban en tests/integration/membresia.repository.test.ts.
import { randomUUID } from "node:crypto";
import type { EstadoCliente, Membresia, MembresiaRepository, Pago } from "../../src/repositories/membresia.repository.js";

export interface FilaMembresia extends Membresia {
  gimnasioId: string;
  clienteId: string;
}

export interface RegistroBitacora {
  gimnasioId: string;
  actorId: string;
  accion: "CREAR" | "ANULAR_PAGO";
  entidad: "membresias" | "pagos";
  entidadId: string;
  datosAntes?: Record<string, unknown>;
  datosDespues: Record<string, unknown>;
}

interface Opciones {
  /** Los clientes que "existen" (basta id, gimnasio y estado). */
  clientes?: { id: string; gimnasioId: string; estadoRegistro: "ACTIVO" | "BLOQUEADO" }[];
  membresias?: FilaMembresia[];
  /** Para responder plan.nombre y registradoPor.nombre, como haría el JOIN real. */
  planes?: { id: string; nombre: string }[];
  staff?: { id: string; nombre: string }[];
  /** "Hoy" para el estado, y los días de aviso del gimnasio (la vista los toma de la BD). */
  hoy?: string;
  diasAviso?: number;
  ahora?: () => Date;
}

const cuenta = (m: Pick<Membresia, "canceladaEn" | "pagos">) => m.canceladaEn === null && m.pagos.some((p) => p.estado === "VALIDO");
const diasEntre = (desde: string, hasta: string) => Math.round((Date.parse(hasta) - Date.parse(desde)) / 86_400_000);

export function crearMembresiaRepositoryFalso({
  clientes = [],
  membresias = [],
  planes = [],
  staff = [],
  hoy = "2026-11-26",
  diasAviso = 7,
  ahora = () => new Date(),
}: Opciones = {}) {
  const filas: FilaMembresia[] = membresias.map((m) => ({ ...m, pagos: m.pagos.map((p) => ({ ...p })) }));
  const bitacora: RegistroBitacora[] = [];

  const activo = (gimnasioId: string, clienteId: string) =>
    clientes.some((c) => c.id === clienteId && c.gimnasioId === gimnasioId && c.estadoRegistro === "ACTIVO");
  const delCliente = (gimnasioId: string, clienteId: string) => filas.filter((m) => m.gimnasioId === gimnasioId && m.clienteId === clienteId);
  const aMembresia = ({ gimnasioId: _g, clienteId: _c, ...m }: FilaMembresia): Membresia => ({ ...m, cuenta: cuenta(m) });
  const nombre = (lista: { id: string; nombre: string }[], id: string) => lista.find((x) => x.id === id)?.nombre ?? "?";

  const repo: MembresiaRepository = {
    async contratar(gimnasioId, clienteId, actorId, planificar) {
      if (!activo(gimnasioId, clienteId)) return null;
      const ocupados = delCliente(gimnasioId, clienteId)
        .filter(cuenta)
        .map(({ fechaInicio, fechaFin }) => ({ fechaInicio, fechaFin }));
      const nueva = planificar(ocupados); // si lanza, no se guarda nada (como el rollback)

      const pago: Pago = {
        id: randomUUID(),
        monto: nueva.precio,
        metodo: nueva.metodo,
        folio: nueva.folio,
        estado: "VALIDO",
        fechaPago: ahora().toISOString(),
        registradoPor: { id: actorId, nombre: nombre(staff, actorId) },
        anulacion: null,
      };
      const fila: FilaMembresia = {
        id: randomUUID(),
        gimnasioId,
        clienteId,
        plan: { id: nueva.planId, nombre: nombre(planes, nueva.planId) },
        fechaInicio: nueva.fechaInicio,
        fechaFin: nueva.fechaFin,
        precioAcordado: nueva.precio,
        canceladaEn: null,
        cuenta: true,
        pagos: [pago],
      };
      filas.push(fila);
      bitacora.push(
        {
          gimnasioId,
          actorId,
          accion: "CREAR",
          entidad: "membresias",
          entidadId: fila.id,
          datosDespues: { clienteId, planId: nueva.planId, fechaInicio: nueva.fechaInicio, fechaFin: nueva.fechaFin, precioAcordado: nueva.precio },
        },
        {
          gimnasioId,
          actorId,
          accion: "CREAR",
          entidad: "pagos",
          entidadId: pago.id,
          datosDespues: { membresiaId: fila.id, monto: nueva.precio, metodo: nueva.metodo, folio: nueva.folio },
        },
      );
      return aMembresia(fila);
    },

    async anularPago(gimnasioId, pagoId, actorId, motivo) {
      // Igual que el real: solo pagos de ESE gimnasio cuyo cliente está activo.
      const fila = filas.find((m) => m.gimnasioId === gimnasioId && activo(gimnasioId, m.clienteId) && m.pagos.some((p) => p.id === pagoId));
      const pago = fila?.pagos.find((p) => p.id === pagoId);
      if (!fila || !pago) return { tipo: "no-existe" };
      if (pago.estado === "ANULADO") return { tipo: "ya-anulado" };

      pago.estado = "ANULADO";
      pago.anulacion = { anuladoEn: ahora().toISOString(), anuladoPor: { id: actorId, nombre: nombre(staff, actorId) }, motivo };
      bitacora.push({
        gimnasioId,
        actorId,
        accion: "ANULAR_PAGO",
        entidad: "pagos",
        entidadId: pagoId,
        datosAntes: { estado: "VALIDO" },
        datosDespues: { estado: "ANULADO", motivo },
      });
      return { tipo: "anulado", membresia: aMembresia(fila) };
    },

    async historial(gimnasioId, clienteId) {
      return delCliente(gimnasioId, clienteId)
        .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
        .map(aMembresia);
    },

    async estado(gimnasioId, clienteId): Promise<EstadoCliente | null> {
      if (!activo(gimnasioId, clienteId)) return null;
      // La misma regla que la vista: la que cuenta y vence más tarde.
      const ultima = delCliente(gimnasioId, clienteId)
        .filter(cuenta)
        .sort((a, b) => b.fechaFin.localeCompare(a.fechaFin))[0];
      if (!ultima) return { estado: "SIN_MEMBRESIA", diasRestantes: null, fechaFin: null, membresiaId: null };
      const diasRestantes = diasEntre(hoy, ultima.fechaFin);
      const estado = diasRestantes < 0 ? "VENCIDO" : diasRestantes <= diasAviso ? "POR_VENCER" : "ACTIVO";
      return { estado, diasRestantes, fechaFin: ultima.fechaFin, membresiaId: ultima.id };
    },
  };

  return { repo, filas, bitacora };
}
