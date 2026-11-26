// Corre una sola vez, antes de todos los tests de integración:
//   1. Genera el cliente de Prisma (no está en Git).
//   2. Borra todo lo que haya en la BD de pruebas (de una corrida anterior).
//   3. Aplica las migraciones REALES con `prisma migrate deploy`, igual que en producción.
// Así cada corrida empieza desde cero y prueba también que las migraciones funcionan en un Postgres limpio.
import { execSync } from "node:child_process";
import { asegurarBdLocal, TEST_DATABASE_URL } from "./test-database-url.js";

export default async function setup() {
  asegurarBdLocal(TEST_DATABASE_URL);

  // prisma.config.ts lee DIRECT_URL: aquí la apuntamos a la BD de pruebas (nunca a Supabase).
  const env = { ...process.env, DIRECT_URL: TEST_DATABASE_URL };
  const correr = (comando: string) => execSync(comando, { env, stdio: "inherit" });

  correr("npx prisma generate");

  // Import dinámico: el cliente generado no existe hasta que corre `prisma generate`.
  const { createPrismaClient } = await import("../../src/lib/prisma.js");
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  try {
    // DROP SCHEMA no pasa fila por fila, así que el trigger "solo inserción" de la bitácora no lo impide.
    await prisma.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await prisma.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await prisma.$disconnect();
  }

  correr("npx prisma migrate deploy");
}
