// /reportes (spec 0008). Ver ingresos es de ADMIN y DUENO, como anular pagos.
import { Router, type RequestHandler } from "express";
import { createReporteController } from "../controllers/reporte.controller.js";
import { requireRole } from "../middlewares/require-auth.js";
import type { ReporteService } from "../services/reporte.service.js";

export function createReporteRouter(service: ReporteService, requireAuth: RequestHandler, ahora?: () => Date): Router {
  const controller = createReporteController(service, ahora);
  const router = Router();

  // Datos de dinero del negocio: sin caché, también en los 401 y 403.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAuth, requireRole("ADMIN", "DUENO"));

  router.get("/ingresos", controller.ingresos);

  return router;
}
