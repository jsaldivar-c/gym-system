// Punto de entrada: aquí SÍ se conecta todo lo real (env, Prisma, Supabase, puerto).
import { createApp } from "./app.js";
import { createTokenVerifier, remoteKeys, supabaseAuthUrls } from "./auth/token-verifier.js";
import { loadEnv } from "./config/env.js";
import { createPrismaClient } from "./lib/prisma.js";
import { createClienteRepository } from "./repositories/cliente.repository.js";
import { createHealthRepository } from "./repositories/health.repository.js";
import { createPerfilStaffRepository } from "./repositories/perfil-staff.repository.js";
import { createPlanRepository } from "./repositories/plan.repository.js";
import { createAuthService } from "./services/auth.service.js";
import { createClienteService } from "./services/cliente.service.js";
import { createHealthService } from "./services/health.service.js";
import { createPlanService } from "./services/plan.service.js";

const env = loadEnv();
const prisma = createPrismaClient(env.databaseUrl);
const { issuer, jwksUrl } = supabaseAuthUrls(env.supabaseUrl);

const app = createApp({
  healthService: createHealthService(createHealthRepository(prisma)),
  authService: createAuthService({
    verifyToken: createTokenVerifier({ keys: remoteKeys(jwksUrl), issuer }),
    perfilRepository: createPerfilStaffRepository(prisma),
  }),
  planService: createPlanService(createPlanRepository(prisma)),
  clienteService: createClienteService(createClienteRepository(prisma)),
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
