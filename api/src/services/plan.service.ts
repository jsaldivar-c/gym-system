// Servicio de planes: reglas de negocio de la spec 0003. No sabe nada de Express ni de Prisma.
import type { AuthContext } from "../auth/roles.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { esUuid } from "../lib/validation.js";
import type { CamposPlan, Plan, PlanRepository } from "../repositories/plan.repository.js";
import type { ActualizarPlanInput, CrearPlanInput } from "../schemas/plan.schema.js";

export interface PlanService {
  listar(auth: AuthContext, opciones: { incluirInactivos: boolean }): Promise<Plan[]>;
  obtener(auth: AuthContext, id: string): Promise<Plan>;
  crear(auth: AuthContext, datos: CrearPlanInput): Promise<Plan>;
  actualizar(auth: AuthContext, id: string, datos: ActualizarPlanInput): Promise<Plan>;
}

const nombreDuplicado = (nombre: string) => new ConflictError(`Ya existe un plan llamado "${nombre}"`);

export function createPlanService(repo: PlanRepository): PlanService {
  async function obtener(auth: AuthContext, id: string): Promise<Plan> {
    // Un id que no es UUID no puede existir: 404 sin consultar la BD.
    const plan = esUuid(id) ? await repo.buscarPorId(auth.gimnasioId, id) : null;
    if (!plan) throw new NotFoundError("Plan");
    return plan;
  }

  return {
    listar(auth, opciones) {
      return repo.listar(auth.gimnasioId, opciones);
    },

    obtener,

    async crear(auth, datos) {
      // Comprobación amable (mensaje claro). El índice único de la BD es la última barrera.
      if (await repo.existeNombre(auth.gimnasioId, datos.nombre)) throw nombreDuplicado(datos.nombre);
      return repo.crear(auth.gimnasioId, datos, auth.userId);
    },

    async actualizar(auth, id, datos) {
      const actual = await obtener(auth, id);

      // Solo los campos que de verdad cambian: eso se guarda en la bitácora.
      const antes: Partial<CamposPlan> = {};
      const despues: Partial<CamposPlan> = {};
      for (const campo of Object.keys(datos) as (keyof CamposPlan)[]) {
        if (datos[campo] !== undefined && datos[campo] !== actual[campo]) {
          Object.assign(antes, { [campo]: actual[campo] });
          Object.assign(despues, { [campo]: datos[campo] });
        }
      }

      if (Object.keys(despues).length === 0) return actual; // nada que cambiar, nada que auditar

      if (despues.nombre !== undefined && (await repo.existeNombre(auth.gimnasioId, despues.nombre, id))) {
        throw nombreDuplicado(despues.nombre);
      }

      const plan = await repo.actualizar(auth.gimnasioId, id, { actorId: auth.userId, antes, despues });
      if (!plan) throw new NotFoundError("Plan"); // lo borraron o movieron entre la lectura y la escritura
      return plan;
    },
  };
}
