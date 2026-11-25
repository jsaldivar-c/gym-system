// Tests de la spec 0001 (docs/specs/0001-api-health.md). Cada `it` es un caso de la tabla.
// No usan una BD real: inyectan un repositorio falso que responde, falla o tarda.
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import type { HealthRepository } from "../src/repositories/health.repository.js";
import { bdOk, crearAppDePrueba, crearClaves } from "./helpers.js";

const bdCaida: HealthRepository = {
  ping: async () => {
    throw new Error('password authentication failed for user "postgres" at db.secreto.supabase.co');
  },
};
const bdLenta: HealthRepository = { ping: () => new Promise(() => {}) }; // nunca responde

let claves: Awaited<ReturnType<typeof crearClaves>>;
beforeAll(async () => {
  claves = await crearClaves();
});

function appCon(healthRepository: HealthRepository, timeoutMs = 2000) {
  return crearAppDePrueba({ keys: claves.jwks, healthRepository, timeoutMs });
}

describe("GET /health (liveness)", () => {
  it("1. responde 200 con la API arriba", async () => {
    const res = await request(appCon(bdOk).app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("5. responde 200 aunque la BD esté caída", async () => {
    const res = await request(appCon(bdCaida).app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /health/ready (readiness)", () => {
  it("2. responde 200 con la BD disponible", async () => {
    const res = await request(appCon(bdOk).app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", checks: { database: "ok" } });
  });

  it("3. responde 503 sin detalle del error si la BD falla (el detalle va al log)", async () => {
    const { app, logger } = appCon(bdCaida);
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", checks: { database: "error" } });
    expect(res.text).not.toMatch(/password|supabase|postgres/i);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("4. responde 503 en cuanto vence el timeout si la BD es lenta", async () => {
    const { app } = appCon(bdLenta, 50); // 50 ms en lugar de 2 s para que el test sea rápido
    const inicio = Date.now();
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.checks.database).toBe("error");
    expect(Date.now() - inicio).toBeLessThan(1000);
  });
});

describe("Cabeceras y rutas desconocidas", () => {
  it.each(["/health", "/health/ready"])("6. %s lleva Cache-Control: no-store y no X-Powered-By", async (ruta) => {
    const res = await request(appCon(bdOk).app).get(ruta);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("7. una ruta inexistente responde 404 en JSON, sin stack trace", async () => {
    const res = await request(appCon(bdOk).app).get("/ruta-que-no-existe");
    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body).toEqual({ error: "Not Found" });
    expect(res.text).not.toMatch(/at \w+ \(|node_modules/);
  });
});
