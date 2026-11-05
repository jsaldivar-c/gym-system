// Configuración del CLI de Prisma 7 (migrate, generate, validate).
// Las migraciones usan DIRECT_URL (conexión directa); la app en tiempo de ejecución usa DATABASE_URL (pooler).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
