// Repositorio de planes EN MEMORIA para los tests: imita las reglas del real
// (filtro por gimnasio, nombre único sin mayúsculas, bitácora) sin base de datos.
// OJO: prueba que el SERVICIO pide lo correcto; las consultas reales de Prisma
// se cubrirán con tests de integración (spec 0003, pregunta abierta 2).
import { randomUUID } from "node:crypto";
import { ConflictError } from "../../src/errors.js";
import type { Auditoria, CamposPlan, Plan, PlanRepository } from "../../src/repositories/plan.repository.js";

interface FilaPlan extends Plan {
  gimnasioId: string;
}

export interface RegistroBitacora {
  gimnasioId: string;
  actorId: string;
  accion: "CREAR" | "ACTUALIZAR";
  entidad: "planes";
  entidadId: string;
  datosAntes: Partial<CamposPlan> | null;
  datosDespues: Partial<CamposPlan>;
}

export function crearPlanRepositoryFalso(inicial: FilaPlan[] = []) {
  const filas: FilaPlan[] = inicial.map((f) => ({ ...f }));
  const bitacora: RegistroBitacora[] = [];

  const sinGimnasio = ({ gimnasioId: _, ...plan }: FilaPlan): Plan => plan;
  const mismoNombre = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

  function exigirNombreLibre(gimnasioId: string, nombre: string, excluirId?: string) {
    // Imita el índice único (gimnasio_id, lower(nombre)) de la BD
    if (filas.some((f) => f.gimnasioId === gimnasioId && f.id !== excluirId && mismoNombre(f.nombre, nombre))) {
      throw new ConflictError(`Ya existe un plan llamado "${nombre}"`);
    }
  }

  const repo: PlanRepository = {
    async listar(gimnasioId, { incluirInactivos }) {
      return filas
        .filter((f) => f.gimnasioId === gimnasioId && (incluirInactivos || f.activo))
        .sort((a, b) => a.duracionMeses - b.duracionMeses || a.nombre.localeCompare(b.nombre))
        .map(sinGimnasio);
    },

    async buscarPorId(gimnasioId, id) {
      const fila = filas.find((f) => f.id === id && f.gimnasioId === gimnasioId);
      return fila ? sinGimnasio(fila) : null;
    },

    async existeNombre(gimnasioId, nombre, excluirId) {
      return filas.some((f) => f.gimnasioId === gimnasioId && f.id !== excluirId && mismoNombre(f.nombre, nombre));
    },

    async crear(gimnasioId, datos, actorId) {
      exigirNombreLibre(gimnasioId, datos.nombre);
      const fila: FilaPlan = { id: randomUUID(), gimnasioId, activo: true, ...datos };
      filas.push(fila);
      const plan = sinGimnasio(fila);
      bitacora.push({ gimnasioId, actorId, accion: "CREAR", entidad: "planes", entidadId: fila.id, datosAntes: null, datosDespues: { ...plan } });
      return plan;
    },

    async actualizar(gimnasioId, id, { actorId, antes, despues }: Auditoria) {
      const fila = filas.find((f) => f.id === id && f.gimnasioId === gimnasioId);
      if (!fila) return null;
      if (despues.nombre !== undefined) exigirNombreLibre(gimnasioId, despues.nombre, id);
      Object.assign(fila, despues);
      bitacora.push({ gimnasioId, actorId, accion: "ACTUALIZAR", entidad: "planes", entidadId: id, datosAntes: antes, datosDespues: despues });
      return sinGimnasio(fila);
    },
  };

  return { repo, filas, bitacora };
}
