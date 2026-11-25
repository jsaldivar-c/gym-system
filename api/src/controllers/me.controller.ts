// GET /me: el perfil del usuario que hace la petición.
// No consulta la BD: requireAuth ya cargó el perfil en esta misma petición.
import type { Request, Response } from "express";
import { getAuth } from "../middlewares/require-auth.js";

export function getMe(req: Request, res: Response) {
  const auth = getAuth(req);
  res.status(200).json({
    id: auth.userId,
    nombre: auth.nombre,
    rol: auth.rol,
    gimnasio: { id: auth.gimnasioId, nombre: auth.gimnasioNombre },
  });
}
