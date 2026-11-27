// /pagos (spec 0007). Por ahora solo la anulación, que es de ADMIN y DUENO.
import { Router, type RequestHandler } from "express";
import { createMembresiaController } from "../controllers/membresia.controller.js";
import { requireRole } from "../middlewares/require-auth.js";
import type { MembresiaService } from "../services/membresia.service.js";

export function createPagoRouter(service: MembresiaService, requireAuth: RequestHandler): Router {
  const controller = createMembresiaController(service);
  const router = Router();

  // Datos de dinero de un cliente: sin caché, también en los 401, 403 y 404.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAuth);

  // POST y no DELETE: no se borra nada, se registra una anulación (quién, cuándo y por qué).
  router.post("/:id/anulacion", requireRole("ADMIN", "DUENO"), controller.anularPago);

  return router;
}
