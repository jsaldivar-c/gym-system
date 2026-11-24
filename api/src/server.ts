// Punto de entrada: aquí SÍ se conecta todo lo real (env, Prisma, puerto).
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";
import { createHealthRepository } from "./repositories/health.repository.js";
import { createHealthService } from "./services/health.service.js";

const env = loadEnv();
const prisma = createPrismaClient(env.databaseUrl);

const app = createApp({
  healthService: createHealthService(createHealthRepository(prisma)),
  webOrigin: env.webOrigin,
});

const server = app.listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}`);
});

// Apagado ordenado: deja terminar las peticiones en curso y cierra las conexiones a la BD.
function shutdown(signal: string) {
  console.log(`${signal} recibido, cerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
