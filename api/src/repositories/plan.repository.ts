// Repositorio de planes: la única capa que consulta `planes` con Prisma.
// REGLA (ADR 0005): cada método recibe el gimnasioId y lo pone en el WHERE. Sin excepción.
import { ConflictError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";

/** Un plan tal como lo ven los servicios: el precio ya es texto, nunca float. */
export interface Plan {
  id: string;
  nombre: string;
  precio: string;
  duracionMeses: number;
  activo: boolean;
}

export type CamposPlan = Omit<Plan, "id">;

/** Qué guardar en la bitácora junto con el cambio. */
export interface Auditoria {
  actorId: string;
  antes: Partial<CamposPlan>;
  despues: Partial<CamposPlan>;
}

export interface PlanRepository {
  listar(gimnasioId: string, opciones: { incluirInactivos: boolean }): Promise<Plan[]>;
  buscarPorId(gimnasioId: string, id: string): Promise<Plan | null>;
  /** ¿Hay otro plan en el gimnasio con ese nombre, sin importar mayúsculas? */
  existeNombre(gimnasioId: string, nombre: string, excluirId?: string): Promise<boolean>;
  crear(gimnasioId: string, datos: Omit<CamposPlan, "activo">, actorId: string): Promise<Plan>;
  /** Devuelve null si el plan no existe en ESE gimnasio. */
  actualizar(gimnasioId: string, id: string, auditoria: Auditoria): Promise<Plan | null>;
}

const SELECT = { id: true, nombre: true, precio: true, duracionMeses: true, activo: true } as const;

function aPlan(fila: { id: string; nombre: string; precio: Prisma.Decimal; duracionMeses: number; activo: boolean }): Plan {
  return { ...fila, precio: fila.precio.toFixed(2) };
}

/** Postgres 23505 = violación de UNIQUE. Prisma la reporta como P2002. */
function esNombreDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function createPlanRepository(prisma: PrismaClient): PlanRepository {
  return {
    async listar(gimnasioId, { incluirInactivos }) {
      const filas = await prisma.plan.findMany({
        where: { gimnasioId, ...(incluirInactivos ? {} : { activo: true }) },
        orderBy: [{ duracionMeses: "asc" }, { nombre: "asc" }],
        select: SELECT,
      });
      return filas.map(aPlan);
    },

    async buscarPorId(gimnasioId, id) {
      // findFirst y no findUnique: findUnique solo acepta el id, y necesitamos AMBAS condiciones.
      const fila = await prisma.plan.findFirst({ where: { id, gimnasioId }, select: SELECT });
      return fila ? aPlan(fila) : null;
    },

    async existeNombre(gimnasioId, nombre, excluirId) {
      const fila = await prisma.plan.findFirst({
        where: {
          gimnasioId,
          nombre: { equals: nombre, mode: "insensitive" },
          ...(excluirId ? { NOT: { id: excluirId } } : {}),
        },
        select: { id: true },
      });
      return fila !== null;
    },

    async crear(gimnasioId, datos, actorId) {
      try {
        // Transacción: el plan y su registro en la bitácora se guardan juntos o ninguno.
        return await prisma.$transaction(async (tx) => {
          const plan = aPlan(await tx.plan.create({ data: { ...datos, gimnasioId }, select: SELECT }));
          await tx.bitacoraAuditoria.create({
            data: {
              gimnasioId,
              actorId,
              accion: "CREAR",
              entidad: "planes",
              entidadId: plan.id,
              datosDespues: { ...plan },
            },
          });
          return plan;
        });
      } catch (error) {
        // Dos peticiones simultáneas con el mismo nombre: la BD detiene la segunda.
        if (esNombreDuplicado(error)) throw new ConflictError(`Ya existe un plan llamado "${datos.nombre}"`);
        throw error;
      }
    },

    async actualizar(gimnasioId, id, { actorId, antes, despues }) {
      try {
        return await prisma.$transaction(async (tx) => {
          // updateMany permite filtrar por id Y gimnasioId. Si es de otro gimnasio, count = 0.
          const { count } = await tx.plan.updateMany({ where: { id, gimnasioId }, data: despues });
          if (count === 0) return null;

          const plan = aPlan(await tx.plan.findFirstOrThrow({ where: { id, gimnasioId }, select: SELECT }));
          await tx.bitacoraAuditoria.create({
            data: {
              gimnasioId,
              actorId,
              accion: "ACTUALIZAR",
              entidad: "planes",
              entidadId: id,
              datosAntes: antes,
              datosDespues: despues,
            },
          });
          return plan;
        });
      } catch (error) {
        if (esNombreDuplicado(error)) throw new ConflictError(`Ya existe un plan llamado "${despues.nombre}"`);
        throw error;
      }
    },
  };
}
