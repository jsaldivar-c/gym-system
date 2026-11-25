// requireAuth: exige un token válido y un perfil activo. Si todo está bien, llena req.auth.
import type { NextFunction, Request, Response } from "express";
import { AuthError } from "../auth/auth-error.js";
import type { AuthContext, Rol } from "../auth/roles.js";
import type { AuthService } from "../services/auth.service.js";

type Logger = Pick<Console, "warn" | "error">;

/** Lee el token de "Authorization: Bearer <token>". Solo de la cabecera, nunca de la URL. */
function leerBearer(req: Request): string | null {
  const header = req.get("authorization");
  const match = header?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
}

/** Respuestas genéricas: el motivo real va SOLO al log (spec 0002, seguridad). */
function responderError(res: Response, error: AuthError) {
  switch (error.kind) {
    case "unauthenticated":
      res.set("WWW-Authenticate", "Bearer").status(401).json({ error: "Unauthorized" });
      return;
    case "forbidden":
      res.status(403).json({ error: "Forbidden" });
      return;
    case "unavailable":
      res.status(503).json({ error: "Service Unavailable" });
      return;
  }
}

export function createRequireAuth(authService: AuthService, logger: Logger = console) {
  return async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = leerBearer(req);
    if (!token) {
      logger.warn("[auth] 401: falta la cabecera Bearer");
      responderError(res, new AuthError("unauthenticated", "sin token"));
      return;
    }

    try {
      req.auth = await authService.authenticate(token);
      next();
    } catch (error) {
      if (!(error instanceof AuthError)) throw error; // p. ej. la BD cayó → errorHandler (500)
      // Nunca se escribe el token, solo el motivo.
      if (error.kind === "unavailable") {
        logger.error(`[auth] ${error.kind}: ${error.reason}`, error.cause);
      } else {
        logger.warn(`[auth] ${error.kind}: ${error.reason}`);
      }
      responderError(res, error);
    }
  };
}

/** Va DESPUÉS de requireAuth. Deja pasar solo a los roles indicados. */
export function requireRole(...roles: Rol[]) {
  return function (req: Request, res: Response, next: NextFunction) {
    const auth = getAuth(req);
    if (!roles.includes(auth.rol)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

/**
 * Devuelve req.auth en las rutas protegidas.
 * Si falta, alguien olvidó poner requireAuth en la ruta: es un error de programación (→ 500).
 */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new Error("getAuth() en una ruta sin requireAuth");
  return req.auth;
}
