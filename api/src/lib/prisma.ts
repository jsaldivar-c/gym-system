// Crea el cliente de Prisma 7 con el "driver adapter" de Postgres (node-postgres).
// Se crea una sola instancia para toda la app: cada PrismaClient abre su propio pool de conexiones.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type { PrismaClient };
