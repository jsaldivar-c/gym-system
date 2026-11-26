// /clientes (spec 0004). Los tres roles pueden buscar, dar de alta y editar.
import { Router, type RequestHandler } from "express";
import { createClienteController } from "../controllers/cliente.controller.js";
import type { ClienteService } from "../services/cliente.service.js";

export function createClienteRouter(service: ClienteService, requireAuth: RequestHandler, ahora?: () => Date): Router {
  const controller = createClienteController(service, ahora);
  const router = Router();

  // Datos personales: ningún navegador ni proxy debe guardar estas respuestas.
  // Va ANTES de requireAuth para que aplique también a los 401 y a los 404.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  router.use(requireAuth);

  router.get("/", controller.listar);
  router.get("/:id", controller.obtener);
  router.post("/", controller.crear);
  router.patch("/:id", controller.actualizar);
  // Sin DELETE: un cliente no se borra (spec 0004).

  return router;
}
