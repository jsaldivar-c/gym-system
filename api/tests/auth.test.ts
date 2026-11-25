// Tests de la spec 0002 (docs/specs/0002-api-autenticacion.md). Cada `it` es un caso de la tabla.
import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createRequireAuth, requireRole } from "../src/middlewares/require-auth.js";
import { crearAppDePrueba, crearClaves, firmarToken, USUARIOS } from "./helpers.js";

let claves: Awaited<ReturnType<typeof crearClaves>>;
let otrasClaves: Awaited<ReturnType<typeof crearClaves>>;

beforeAll(async () => {
  claves = await crearClaves();
  otrasClaves = await crearClaves("clave-ajena");
});

const app = () => crearAppDePrueba({ keys: claves.jwks });
const getMe = (token?: string, esquema = "Bearer") => {
  const req = request(app().app).get("/me");
  return token === undefined ? req : req.set("Authorization", `${esquema} ${token}`);
};

/** Comprueba un 401 genérico: código, cuerpo exacto y cabecera WWW-Authenticate (casos 2-9 y 15). */
function esperar401(res: request.Response) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: "Unauthorized" });
  expect(res.headers["www-authenticate"]).toBe("Bearer");
}

describe("GET /me", () => {
  it("1. token válido y perfil activo → 200 con el perfil", async () => {
    const res = await getMe(await firmarToken(claves));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: USUARIOS.recepcion.id,
      nombre: "Ana López",
      rol: "RECEPCION",
      gimnasio: { id: USUARIOS.recepcion.gimnasioId, nombre: "Gym Centro" },
    });
  });

  it("16. lleva Cache-Control: no-store", async () => {
    const res = await getMe(await firmarToken(claves));
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});

describe("401: no sé quién eres", () => {
  it("2. sin cabecera Authorization", async () => {
    esperar401(await getMe());
  });

  it("3. cabecera sin el prefijo Bearer", async () => {
    esperar401(await getMe(await firmarToken(claves), "Basic"));
  });

  it("4. firma alterada", async () => {
    const token = await firmarToken(claves);
    const [header, payload, firma] = token.split(".");
    const otraFirma = firma!.startsWith("A") ? `B${firma!.slice(1)}` : `A${firma!.slice(1)}`;
    esperar401(await getMe(`${header}.${payload}.${otraFirma}`));
  });

  it("4b. payload alterado (cambiar el sub por otro usuario)", async () => {
    const token = await firmarToken(claves);
    const [header, , firma] = token.split(".");
    const payloadFalso = Buffer.from(JSON.stringify({ sub: USUARIOS.dueno.id })).toString("base64url");
    esperar401(await getMe(`${header}.${payloadFalso}.${firma}`));
  });

  it("5. firmado con otra clave que no está en el JWKS", async () => {
    esperar401(await getMe(await firmarToken(otrasClaves)));
  });

  it("5b. firmado con otra clave pero haciéndose pasar por nuestro kid", async () => {
    esperar401(await getMe(await firmarToken({ privateKey: otrasClaves.privateKey, kid: claves.kid })));
  });

  it("6. token expirado (más allá de la tolerancia de 30 s)", async () => {
    const hace2Min = Math.floor(Date.now() / 1000) - 120;
    esperar401(await getMe(await firmarToken(claves, { exp: hace2Min })));
  });

  it("6b. expirado hace 10 s → todavía pasa por la tolerancia de 30 s", async () => {
    const hace10s = Math.floor(Date.now() / 1000) - 10;
    const res = await getMe(await firmarToken(claves, { exp: hace10s }));
    expect(res.status).toBe(200);
  });

  it("7. iss de otro proyecto", async () => {
    esperar401(await getMe(await firmarToken(claves, { iss: "https://otro-proyecto.supabase.co/auth/v1" })));
  });

  it("8. aud distinto de authenticated", async () => {
    esperar401(await getMe(await firmarToken(claves, { aud: "anon" })));
  });

  it("9a. alg: none (token sin firma)", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${b64({ alg: "none", typ: "JWT" })}.${b64({
      sub: USUARIOS.recepcion.id,
      iss: "https://proyecto-de-prueba.supabase.co/auth/v1",
      aud: "authenticated",
      exp,
    })}.`;
    esperar401(await getMe(token));
  });

  it("9b. alg: HS256 (secreto compartido)", async () => {
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", kid: claves.kid })
      .setSubject(USUARIOS.recepcion.id)
      .setIssuer("https://proyecto-de-prueba.supabase.co/auth/v1")
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("un-secreto-cualquiera-de-32-bytes!!"));
    esperar401(await getMe(token));
  });

  it("9c. sub que no es un UUID", async () => {
    esperar401(await getMe(await firmarToken(claves, { sub: "admin" })));
  });

  it("9d. texto que ni siquiera es un JWT", async () => {
    esperar401(await getMe("esto-no-es-un-jwt"));
  });
});

describe("403: sé quién eres, pero no puedes", () => {
  it("10. token válido pero sin perfil de staff", async () => {
    const res = await getMe(await firmarToken(claves, { sub: USUARIOS.sinPerfil.id }));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("11. token válido con perfil inactivo", async () => {
    const res = await getMe(await firmarToken(claves, { sub: USUARIOS.inactivo.id }));
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  // requireRole todavía no se usa en rutas reales: se prueba con una mini app.
  function appConRol() {
    const { authService } = crearAppDePrueba({ keys: claves.jwks });
    const mini = express();
    mini.post(
      "/pagos/1/anular",
      createRequireAuth(authService, { warn: () => {}, error: () => {} }),
      requireRole("ADMIN", "DUENO"),
      (_req, res) => {
        res.json({ anulado: true });
      },
    );
    return mini;
  }

  it("12. requireRole(ADMIN, DUENO) con rol RECEPCION → 403", async () => {
    const token = await firmarToken(claves, { sub: USUARIOS.recepcion.id });
    const res = await request(appConRol()).post("/pagos/1/anular").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "Forbidden" });
  });

  it("13. requireRole(ADMIN, DUENO) con rol DUENO → pasa al controlador", async () => {
    const token = await firmarToken(claves, { sub: USUARIOS.dueno.id });
    const res = await request(appConRol()).post("/pagos/1/anular").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ anulado: true });
  });
});

describe("503 y seguridad de las respuestas", () => {
  it("14. el JWKS no responde → 503 (el motivo va al log de errores)", async () => {
    const jwksCaido = async () => {
      throw new TypeError("fetch failed");
    };
    const { app: appSinJwks, logger } = crearAppDePrueba({ keys: jwksCaido });
    const res = await request(appSinJwks)
      .get("/me")
      .set("Authorization", `Bearer ${await firmarToken(claves)}`);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Service Unavailable" });
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("15. el cuerpo nunca trae el motivo y el log nunca trae el token", async () => {
    const token = await firmarToken(claves, { aud: "anon" });
    const { app: a, logger } = crearAppDePrueba({ keys: claves.jwks });
    const res = await request(a).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.text).toBe('{"error":"Unauthorized"}');
    const todoElLog = JSON.stringify([...logger.warn.mock.calls, ...logger.error.mock.calls]);
    expect(todoElLog).not.toContain(token);
    expect(todoElLog).toContain("aud"); // pero sí el motivo, para depurar
  });

  it("17. GET /health sigue siendo público (sin token)", async () => {
    const res = await request(app().app).get("/health");
    expect(res.status).toBe(200);
  });
});
