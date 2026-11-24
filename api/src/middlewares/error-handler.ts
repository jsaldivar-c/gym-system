import type { NextFunction, Request, Response } from "express";

/**
 * Último middleware: atrapa cualquier error no manejado.
 * Express lo reconoce como manejador de errores porque recibe 4 parámetros.
 * El stack trace va al log, NUNCA a la respuesta.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Errores "esperados" de Express (p. ej. JSON mal formado → 400) traen su propio status.
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
