// Arma la app de Express SIN arrancar el servidor ni conectarse a la BD.
// Recibe sus dependencias desde fuera ("inyección de dependencias"): así los tests
// le pasan un servicio falso y no necesitan una base de datos real.
import cors from "cors";
import express, { type Express } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFound } from "./middlewares/not-found.js";
import { createHealthRouter } from "./routes/health.routes.js";
import type { HealthService } from "./services/health.service.js";

export interface AppDeps {
  healthService: HealthService;
  webOrigin: string;
}

export function createApp({ healthService, webOrigin }: AppDeps): Express {
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

  // ─── Rutas ───
  app.use("/health", createHealthRouter(healthService));

  // ─── Al final: 404 y errores ───
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
