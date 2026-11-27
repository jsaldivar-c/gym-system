// Repositorio de clientes EN MEMORIA para los tests: imita las reglas del real
// (filtro por gimnasio, solo ACTIVOS, teléfono único, búsqueda, paginación y bitácora) sin base de datos.
// Las consultas reales de Prisma se prueban en tests/integration/cliente.repository.test.ts.
import { randomUUID } from "node:crypto";
import { ConflictError } from "../../src/errors.js";
import type { Auditoria, Busqueda, CamposCliente, Cliente, ClienteConEstado, ClienteRepository } from "../../src/repositories/cliente.repository.js";
import type { Estado, EstadoCliente } from "../../src/repositories/membresia.repository.js";

export interface FilaCliente extends Cliente {
  gimnasioId: string;
  estadoRegistro: "ACTIVO" | "BLOQUEADO";
}

export interface RegistroBitacora {
  gimnasioId: string;
  actorId: string;
  accion: "CREAR" | "ACTUALIZAR";
  entidad: "clientes";
  entidadId: string;
  datosAntes: Partial<CamposCliente> | null;
  datosDespues: Partial<CamposCliente>;
}

export const SIN_MEMBRESIA: EstadoCliente = { estado: "SIN_MEMBRESIA", diasRestantes: null, fechaFin: null, membresiaId: null };

/**
 * `estados`: el semáforo de cada cliente por id, como si viniera de la vista (spec 0006).
 * El que no aparezca queda SIN_MEMBRESIA. La regla real de la vista se prueba en integración.
 */
export function crearClienteRepositoryFalso(inicial: FilaCliente[] = [], estados: Record<string, EstadoCliente> = {}) {
  const filas: FilaCliente[] = inicial.map((f) => ({ ...f }));
  const bitacora: RegistroBitacora[] = [];
  const llamadas: { listar: { busqueda?: Busqueda; estado?: Estado; pagina: number; porPagina: number }[] } = { listar: [] };

  const aCliente = ({ gimnasioId: _g, estadoRegistro: _e, ...cliente }: FilaCliente): Cliente => cliente;
  const estadoDe = (id: string) => estados[id] ?? SIN_MEMBRESIA;
  const conEstado = (f: FilaCliente): ClienteConEstado => ({ ...aCliente(f), estado: estadoDe(f.id) });
  const visibles = (gimnasioId: string) => filas.filter((f) => f.gimnasioId === gimnasioId && f.estadoRegistro === "ACTIVO");
  const contiene = (texto: string, parte: string) => texto.toLowerCase().includes(parte.toLowerCase());

  function coincide(f: FilaCliente, busqueda?: Busqueda) {
    if (!busqueda) return true;
    if ("telefono" in busqueda) return f.telefono.includes(busqueda.telefono);
    return busqueda.palabras.every((p) => contiene(f.nombres, p) || contiene(f.apellidos, p));
  }

  function exigirTelefonoLibre(gimnasioId: string, telefono: string, excluirId?: string) {
    // Imita el UNIQUE(gimnasio_id, telefono) de la BD (incluye bloqueados)
    if (filas.some((f) => f.gimnasioId === gimnasioId && f.id !== excluirId && f.telefono === telefono)) {
      throw new ConflictError(`Ya existe un cliente con el teléfono ${telefono}`);
    }
  }

  const repo: ClienteRepository = {
    async listar(gimnasioId, opciones) {
      llamadas.listar.push(opciones);
      const { busqueda, estado, pagina, porPagina } = opciones;
      const todos = visibles(gimnasioId)
        .filter((f) => coincide(f, busqueda))
        .filter((f) => !estado || estadoDe(f.id).estado === estado)
        .sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombres.localeCompare(b.nombres) || a.id.localeCompare(b.id));
      const inicio = (pagina - 1) * porPagina;
      return { clientes: todos.slice(inicio, inicio + porPagina).map(conEstado), total: todos.length };
    },

    async buscarPorId(gimnasioId, id) {
      const fila = visibles(gimnasioId).find((f) => f.id === id);
      return fila ? aCliente(fila) : null;
    },

    async buscarConEstado(gimnasioId, id) {
      const fila = visibles(gimnasioId).find((f) => f.id === id);
      return fila ? conEstado(fila) : null;
    },

    async buscarIdPorTelefono(gimnasioId, telefono, excluirId) {
      return visibles(gimnasioId).find((f) => f.telefono === telefono && f.id !== excluirId)?.id ?? null;
    },

    async crear(gimnasioId, datos, actorId) {
      exigirTelefonoLibre(gimnasioId, datos.telefono);
      const fila: FilaCliente = { id: randomUUID(), gimnasioId, estadoRegistro: "ACTIVO", ...datos };
      filas.push(fila);
      bitacora.push({ gimnasioId, actorId, accion: "CREAR", entidad: "clientes", entidadId: fila.id, datosAntes: null, datosDespues: { ...datos } });
      return aCliente(fila);
    },

    async actualizar(gimnasioId, id, { actorId, antes, despues }: Auditoria) {
      const fila = visibles(gimnasioId).find((f) => f.id === id);
      if (!fila) return null;
      if (despues.telefono !== undefined) exigirTelefonoLibre(gimnasioId, despues.telefono, id);
      Object.assign(fila, despues);
      bitacora.push({ gimnasioId, actorId, accion: "ACTUALIZAR", entidad: "clientes", entidadId: id, datosAntes: antes, datosDespues: despues });
      return aCliente(fila);
    },
  };

  return { repo, filas, bitacora, llamadas };
}
