// /clientes/:clienteId/membresias (spec 0005). Los tres roles pueden cobrar, renovar y ver el historial.
import { Router, type RequestHandler } from "express";
import { createMembresiaController } from "../controllers/membresia.controller.js";
import type { MembresiaService } from "../services/membresia.service.js";

export function createMembresiaRouter(service: MembresiaService, requireAuth: RequestHandler, ahora?: () => Date): Router {
  const controller = createMembresiaController(service, ahora);
  // mergeParams: sin esto, este router no vería el :clienteId, que está en la ruta donde se monta.
  const router = Router({ mergeParams: true });

  // Datos de un cliente: sin caché, también en los 401 y 404 (igual que /clientes).
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAuth);

  router.get("/", controller.historial);
  router.post("/", controller.contratar);

  return router;
}
