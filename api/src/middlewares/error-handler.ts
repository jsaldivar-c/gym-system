import type { NextFunction, Request, Response } from "express";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";

/**
 * Último middleware: atrapa cualquier error no manejado y lo traduce a HTTP.
 * Express lo reconoce como manejador de errores porque recibe 4 parámetros.
 * El stack trace va al log, NUNCA a la respuesta.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // ─── Errores de dominio (los lanzan los servicios) ───
  if (err instanceof ValidationError) {
    res.status(400).json({ error: "Bad Request", detalles: err.detalles });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ error: "Conflict", mensaje: err.message });
    return;
  }

  // ─── Errores "esperados" de Express (p. ej. JSON mal formado → 400) ───
  const status =
    typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
      ? err.status
      : 500;

  if (status >= 500) {
    console.error("[error]", err);
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
  res.status(status).json({ error: "Bad Request" });
}
