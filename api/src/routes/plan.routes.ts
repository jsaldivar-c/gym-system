// /planes (spec 0003). Leer: cualquier rol. Crear y cambiar: ADMIN y DUENO.
import { Router, type RequestHandler } from "express";
import { createPlanController } from "../controllers/plan.controller.js";
import { requireRole } from "../middlewares/require-auth.js";
import type { PlanService } from "../services/plan.service.js";

export function createPlanRouter(service: PlanService, requireAuth: RequestHandler): Router {
  const controller = createPlanController(service);
  const puedeEditar = requireRole("ADMIN", "DUENO");
  const router = Router();

  router.use(requireAuth); // TODAS las rutas de este router exigen sesión

  router.get("/", controller.listar);
  router.get("/:id", controller.obtener);
  router.post("/", puedeEditar, controller.crear);
  router.patch("/:id", puedeEditar, controller.actualizar);
  // Sin DELETE: un plan se desactiva con PATCH { "activo": false }.

  return router;
}
