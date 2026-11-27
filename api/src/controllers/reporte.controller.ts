// Controlador de reportes: valida la query con Zod, llama al servicio y responde.
import type { Request, Response } from "express";
import { hoyEn } from "../lib/fechas.js";
import { validar } from "../lib/validation.js";
import { getAuth } from "../middlewares/require-auth.js";
import { esquemaIngresos } from "../schemas/reporte.schema.js";
import type { ReporteService } from "../services/reporte.service.js";

/** `ahora` se inyecta para que los tests controlen qué día es "hoy". */
export function createReporteController(service: ReporteService, ahora: () => Date = () => new Date()) {
  return {
    async ingresos(req: Request, res: Response) {
      const auth = getAuth(req);
      const rango = validar(esquemaIngresos(hoyEn(auth.zonaHoraria, ahora())), req.query);
      res.json(await service.ingresos(auth, rango));
    },
  };
}
