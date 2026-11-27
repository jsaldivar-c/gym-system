// Servicio de membresías: reglas de negocio de la spec 0005. No sabe nada de Express ni de Prisma.
import type { AuthContext } from "../auth/roles.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";
import { calcularFechaFin, sumarDias } from "../lib/fechas.js";
import { esUuid } from "../lib/validation.js";
import type { ClienteRepository } from "../repositories/cliente.repository.js";
import type { EstadoCliente, Membresia, MembresiaRepository, Periodo } from "../repositories/membresia.repository.js";
import type { PlanRepository } from "../repositories/plan.repository.js";
import type { AnularInput, ContratarInput } from "../schemas/membresia.schema.js";

export interface HistorialDeCliente {
  estado: EstadoCliente;
  membresias: Membresia[];
}

export interface MembresiaService {
  historial(auth: AuthContext, clienteId: string): Promise<HistorialDeCliente>;
  /** `hoy` es la fecha en la zona del gimnasio: la calcula quien conoce el reloj (el controlador). */
  contratar(auth: AuthContext, clienteId: string, datos: ContratarInput, hoy: string): Promise<Membresia>;
  /** Spec 0007. El permiso (ADMIN y DUENO) lo revisa la ruta con requireRole. Devuelve la membresía del pago. */
  anularPago(auth: AuthContext, pagoId: string, datos: AnularInput): Promise<Membresia>;
}

/**
 * Decide el periodo de la membresía nueva (función pura: fácil de probar).
 * - Sin fechaInicio: el día después de la última que cuenta, si sigue vigente; si no, hoy.
 * - Nunca se encima con un periodo ocupado: si lo hace → 409 con la fecha sugerida.
 */
export function planificarPeriodo(ocupados: Periodo[], { hoy, meses, fechaInicio }: { hoy: string; meses: number; fechaInicio?: string }): Periodo {
  // Las fechas "YYYY-MM-DD" se comparan bien como texto: "2026-11-30" > "2026-11-04".
  const ultimoFin = ocupados.reduce<string | null>((max, o) => (max === null || o.fechaFin > max ? o.fechaFin : max), null);
  const sugerida = ultimoFin !== null && ultimoFin >= hoy ? sumarDias(ultimoFin, 1) : hoy;

  const inicio = fechaInicio ?? sugerida;
  const fin = calcularFechaFin(inicio, meses);

  // Dos periodos se enciman si cada uno empieza antes de que el otro termine.
  const choque = ocupados.find((o) => inicio <= o.fechaFin && fin >= o.fechaInicio);
  if (choque) {
    throw new ConflictError(`Se encima con la membresía del ${choque.fechaInicio} al ${choque.fechaFin}`, { fechaInicioSugerida: sugerida });
  }
  return { fechaInicio: inicio, fechaFin: fin };
}

export function createMembresiaService(repos: {
  membresias: MembresiaRepository;
  planes: PlanRepository;
  clientes: ClienteRepository;
}): MembresiaService {
  const { membresias, planes, clientes } = repos;

  return {
    async historial(auth, clienteId) {
      // La vista solo tiene clientes activos de ESE gimnasio: si no hay fila, para el usuario no existe.
      const estado = esUuid(clienteId) ? await membresias.estado(auth.gimnasioId, clienteId) : null;
      if (!estado) throw new NotFoundError("Cliente");
      return { estado, membresias: await membresias.historial(auth.gimnasioId, clienteId) };
    },

    async contratar(auth, clienteId, datos, hoy) {
      // Primero la dirección (404) y después el body (400 del plan).
      const cliente = esUuid(clienteId) ? await clientes.buscarPorId(auth.gimnasioId, clienteId) : null;
      if (!cliente) throw new NotFoundError("Cliente");

      // Con el gimnasioId: un plan de otro gimnasio responde igual que uno que no existe.
      const plan = await planes.buscarPorId(auth.gimnasioId, datos.planId);
      if (!plan) throw new ValidationError([{ campo: "planId", mensaje: "El plan no existe" }]);
      if (!plan.activo) throw new ValidationError([{ campo: "planId", mensaje: "El plan ya no está a la venta" }]);

      const membresia = await membresias.contratar(auth.gimnasioId, clienteId, auth.userId, (ocupados) => ({
        ...planificarPeriodo(ocupados, { hoy, meses: plan.duracionMeses, fechaInicio: datos.fechaInicio }),
        planId: plan.id,
        precio: plan.precio, // del plan, nunca del body
        metodo: datos.metodo,
        folio: datos.folio ?? null,
      }));
      if (!membresia) throw new NotFoundError("Cliente"); // lo bloquearon entre la lectura y el cobro
      return membresia;
    },

    async anularPago(auth, pagoId, { motivo }) {
      // Un id que no es UUID no puede existir: 404 sin consultar la BD.
      if (!esUuid(pagoId)) throw new NotFoundError("Pago");
      const resultado = await membresias.anularPago(auth.gimnasioId, pagoId, auth.userId, motivo);
      if (resultado.tipo === "no-existe") throw new NotFoundError("Pago");
      if (resultado.tipo === "ya-anulado") throw new ConflictError("El pago ya está anulado");
      return resultado.membresia;
    },
  };
}
