// Arma la app de Express SIN arrancar el servidor ni conectarse a la BD.
// Recibe sus dependencias desde fuera ("inyección de dependencias"): así los tests
// le pasan un servicio falso y no necesitan una base de datos real.
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { createErrorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { createRequireAuth } from "./middlewares/require-auth.js";
import { createClienteRouter } from "./routes/cliente.routes.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createMembresiaRouter } from "./routes/membresia.routes.js";
import { createMeRouter } from "./routes/me.routes.js";
import { createPlanRouter } from "./routes/plan.routes.js";
import type { AuthService } from "./services/auth.service.js";
import type { ClienteService } from "./services/cliente.service.js";
import type { HealthService } from "./services/health.service.js";
import type { MembresiaService } from "./services/membresia.service.js";
import type { PlanService } from "./services/plan.service.js";

export interface AppDeps {
  healthService: HealthService;
  authService: AuthService;
  planService: PlanService;
  clienteService: ClienteService;
  membresiaService: MembresiaService;
  webOrigin: string;
  logger?: Pick<Console, "warn" | "error">;
  /** Reloj: los tests lo fijan para controlar qué día es "hoy". */
  ahora?: () => Date;
}

export function createApp({
  healthService,
  authService,
  planService,
  clienteService,
  membresiaService,
  webOrigin,
  logger = console,
  ahora,
}: AppDeps): Express {
  const requireAuth = createRequireAuth(authService, logger);

  const app = express();

  // ─── Middlewares globales (aplican a TODA la API, health incluido) ───
  app.disable("x-powered-by"); // no anunciar que usamos Express
  app.use(helmet()); // cabeceras de seguridad
  app.use(cors({ origin: webOrigin })); // solo el frontend puede llamarnos desde el navegador
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // ventana de 15 minutos
      limit: 300, // peticiones por IP en esa ventana
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  // ─── Rutas públicas ───
  app.use("/health", createHealthRouter(healthService));

  // ─── Rutas protegidas (cada router pone requireAuth en sus rutas) ───
  app.use("/me", createMeRouter(requireAuth));
  app.use("/planes", createPlanRouter(planService, requireAuth));
  // Antes que /clientes: es más específica y trae su propio requireAuth.
  app.use("/clientes/:clienteId/membresias", createMembresiaRouter(membresiaService, requireAuth, ahora));
  app.use("/clientes", createClienteRouter(clienteService, requireAuth, ahora));

  // ─── Al final: 404 y errores ───
  app.use(notFound);
  app.use(createErrorHandler(logger));

  return app;
}
