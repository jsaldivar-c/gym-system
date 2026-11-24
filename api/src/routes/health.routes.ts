// Rutas: solo definen URL + método y a qué controlador van.
import { Router } from "express";
import { createHealthController } from "../controllers/health.controller.js";
import type { HealthService } from "../services/health.service.js";

export function createHealthRouter(service: HealthService): Router {
  const controller = createHealthController(service);
  const router = Router();

  // Ningún proxy debe guardar un "ok" viejo.
  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", controller.liveness);
  router.get("/ready", controller.readiness);

  return router;
}
