// Controlador: traduce entre HTTP y el servicio (lee la petición, elige el código de estado).
import type { Request, Response } from "express";
import type { HealthService } from "../services/health.service.js";

export function createHealthController(service: HealthService) {
  return {
    liveness(_req: Request, res: Response) {
      res.status(200).json({ status: "ok" });
    },

    async readiness(_req: Request, res: Response) {
      const result = await service.readiness();
      res.status(result.status === "ok" ? 200 : 503).json(result);
    },
  };
}
