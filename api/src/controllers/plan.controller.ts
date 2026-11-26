// Controlador de planes: lee la petición, valida con Zod, llama al servicio y responde.
// Los errores (400/404/409) los lanza el servicio o validar(); Express 5 los pasa al errorHandler.
import type { Request, Response } from "express";
import { validar } from "../lib/validation.js";
import { getAuth } from "../middlewares/require-auth.js";
import { actualizarPlanSchema, crearPlanSchema } from "../schemas/plan.schema.js";
import type { PlanService } from "../services/plan.service.js";

export function createPlanController(service: PlanService) {
  return {
    async listar(req: Request, res: Response) {
      const incluirInactivos = req.query["incluirInactivos"] === "true";
      const data = await service.listar(getAuth(req), { incluirInactivos });
      res.json({ data });
    },

    async obtener(req: Request<{ id: string }>, res: Response) {
      res.json(await service.obtener(getAuth(req), req.params.id));
    },

    async crear(req: Request, res: Response) {
      const datos = validar(crearPlanSchema, req.body);
      const plan = await service.crear(getAuth(req), datos);
      res.status(201).location(`/planes/${plan.id}`).json(plan);
    },

    async actualizar(req: Request<{ id: string }>, res: Response) {
      const datos = validar(actualizarPlanSchema, req.body);
      res.json(await service.actualizar(getAuth(req), req.params.id, datos));
    },
  };
}
