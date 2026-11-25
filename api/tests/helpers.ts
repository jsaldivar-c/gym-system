// Utilidades compartidas por los tests: claves ES256 propias, tokens de prueba y fakes.
// Así los tests NO dependen de Supabase ni de una base de datos.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from "jose";
import { vi } from "vitest";
import { createApp } from "../src/app.js";
import { createTokenVerifier } from "../src/auth/token-verifier.js";
import type { HealthRepository } from "../src/repositories/health.repository.js";
import type { PerfilStaff, PerfilStaffRepository } from "../src/repositories/perfil-staff.repository.js";
import { createAuthService } from "../src/services/auth.service.js";
import { createHealthService } from "../src/services/health.service.js";

export const ISSUER = "https://proyecto-de-prueba.supabase.co/auth/v1";

/** Un par de claves como el de Supabase: la privada firma (aquí, los tests), la pública verifica (la API). */
export async function crearClaves(kid = "clave-prueba") {
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256" };
  return { privateKey, kid, jwks: createLocalJWKSet({ keys: [jwk] }) };
}

type Claves = Awaited<ReturnType<typeof crearClaves>>;

/** Firma un token "como Supabase". Cada opción permite romper una regla a propósito. */
export function firmarToken(
  { privateKey, kid }: Pick<Claves, "privateKey" | "kid">,
  { sub = USUARIOS.recepcion.id, iss = ISSUER, aud = "authenticated", exp = "1h" as string | number } = {},
) {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid })
    .setSubject(sub)
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(privateKey);
}

const GIMNASIO = { id: "9b2e4c1a-0000-4000-8000-000000000001", nombre: "Gym Centro" };

function perfil(id: string, nombre: string, rol: PerfilStaff["rol"], activo = true): PerfilStaff {
  return { id, gimnasioId: GIMNASIO.id, nombre, rol, activo, gimnasio: GIMNASIO };
}

export const USUARIOS = {
  recepcion: perfil("6f1c0000-0000-4000-8000-000000000001", "Ana López", "RECEPCION"),
  dueno: perfil("6f1c0000-0000-4000-8000-000000000002", "Carlos Ruiz", "DUENO"),
  inactivo: perfil("6f1c0000-0000-4000-8000-000000000003", "Ex Empleado", "RECEPCION", false),
  sinPerfil: { id: "6f1c0000-0000-4000-8000-000000000004" },
};

export const perfilesFalsos: PerfilStaffRepository = {
  findById: async (id) => [USUARIOS.recepcion, USUARIOS.dueno, USUARIOS.inactivo].find((p) => p.id === id) ?? null,
};

export const bdOk: HealthRepository = { ping: async () => {} };

/** La app completa con dependencias falsas. Cualquier pieza se puede reemplazar. */
export function crearAppDePrueba({
  keys,
  healthRepository = bdOk,
  timeoutMs = 2000,
}: {
  keys: JWTVerifyGetKey;
  healthRepository?: HealthRepository;
  timeoutMs?: number;
}) {
  const logger = { warn: vi.fn(), error: vi.fn() };
  const authService = createAuthService({
    verifyToken: createTokenVerifier({ keys, issuer: ISSUER }),
    perfilRepository: perfilesFalsos,
  });
  const app = createApp({
    healthService: createHealthService(healthRepository, { timeoutMs, logger }),
    authService,
    webOrigin: "http://localhost:5173",
    logger,
  });
  return { app, logger, authService };
}
