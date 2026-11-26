// Controlador de membresías: lee la petición, valida con Zod, llama al servicio y da forma a la respuesta.
import type { Request, Response } from "express";
import { hoyEn } from "../lib/fechas.js";
import { validar } from "../lib/validation.js";
import { getAuth } from "../middlewares/require-auth.js";
import { esquemaContratar } from "../schemas/membresia.schema.js";
import type { MembresiaService } from "../services/membresia.service.js";

type ConCliente = Request<{ clienteId: string }>;

/** `ahora` se inyecta para que los tests controlen qué día es "hoy". */
export function createMembresiaController(service: MembresiaService, ahora: () => Date = () => new Date()) {
  return {
    async historial(req: ConCliente, res: Response) {
      const { estado, membresias } = await service.historial(getAuth(req), req.params.clienteId);
      res.json({ estado, data: membresias });
    },

    async contratar(req: ConCliente, res: Response) {
      const auth = getAuth(req);
      const hoy = hoyEn(auth.zonaHoraria, ahora());
      const datos = validar(esquemaContratar(hoy), req.body);
      // Sin Location: una membresía no tiene dirección propia (spec 0005).
      res.status(201).json(await service.contratar(auth, req.params.clienteId, datos, hoy));
    },
  };
}
