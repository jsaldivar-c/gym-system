// Repositorio: la ÚNICA capa que habla con Prisma.
import type { PrismaClient } from "../lib/prisma.js";

export interface HealthRepository {
  /** Lanza un error si la BD no responde. */
  ping(): Promise<void>;
}

export function createHealthRepository(prisma: PrismaClient): HealthRepository {
  return {
    async ping() {
      // SELECT 1 no lee ninguna tabla: solo comprueba que hay conexión.
      await prisma.$queryRaw`SELECT 1`;
    },
  };
}
