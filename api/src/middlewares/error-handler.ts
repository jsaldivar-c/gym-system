import type { NextFunction, Request, Response } from "express";
import { ConflictError, NotFoundError, ValidationError } from "../errors.js";

type Logger = Pick<Console, "error">;

/**
 * Qué se escribe en el log cuando algo falla con 500.
 * Los errores de Prisma pueden traer en su mensaje los DATOS de la consulta (nombre, teléfono…),
 * y los logs no deben guardar datos personales (spec 0004). De ellos solo se registra el tipo y el código.
 */
function paraElLog(err: unknown): unknown {
  if (err instanceof Error && err.name.startsWith("PrismaClient")) {
    const code = "code" in err ? ` ${String(err.code)}` : "";
    return `${err.name}${code} (mensaje omitido: puede contener datos personales)`;
  }
  return err;
}

/**
 * Último middleware: atrapa cualquier error no manejado y lo traduce a HTTP.
 * Express lo reconoce como manejador de errores porque recibe 4 parámetros.
 * El stack trace va al log, NUNCA a la respuesta.
 */
export function createErrorHandler(logger: Logger = console) {
  return function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
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
      res.status(409).json({ error: "Conflict", mensaje: err.message, ...err.extra });
      return;
    }

    // ─── Errores "esperados" de Express (p. ej. JSON mal formado → 400) ───
    const status =
      typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
        ? err.status
        : 500;

    if (status >= 500) {
      logger.error("[error]", paraElLog(err));
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }
    res.status(status).json({ error: "Bad Request" });
  };
}
