// Servicio: la lógica (aquí, el timeout y traducir el resultado a "ok" / "error").
// No sabe nada de Express ni de Prisma, por eso se prueba sin servidor ni BD.
import type { HealthRepository } from "../repositories/health.repository.js";

export type CheckStatus = "ok" | "error";

export interface ReadinessResult {
  status: CheckStatus;
  checks: { database: CheckStatus };
}

export interface HealthService {
  readiness(): Promise<ReadinessResult>;
}

export const DB_TIMEOUT_MS = 2000;

/** Rechaza si `promesa` tarda más de `ms`. Limpia el temporizador en cualquier caso. */
async function conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`La BD no respondió en ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promesa, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

interface HealthServiceOptions {
  timeoutMs?: number;
  logger?: Pick<Console, "error">;
}

export function createHealthService(
  repository: HealthRepository,
  { timeoutMs = DB_TIMEOUT_MS, logger = console }: HealthServiceOptions = {},
): HealthService {
  return {
    async readiness() {
      try {
        await conTimeout(repository.ping(), timeoutMs);
        return { status: "ok", checks: { database: "ok" } };
      } catch (error) {
        // El detalle va SOLO al log del servidor, nunca a la respuesta (spec 0001, seguridad).
        logger.error("[health] readiness: la BD falló", error);
        return { status: "error", checks: { database: "error" } };
      }
    },
  };
}
