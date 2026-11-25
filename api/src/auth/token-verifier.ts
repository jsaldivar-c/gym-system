// Verifica los JWT que emite Supabase Auth, con la clave PÚBLICA del JWKS del proyecto.
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";
import { AuthError } from "./auth-error.js";

export type TokenVerifier = (token: string) => Promise<{ userId: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** URLs del proyecto de Supabase a partir de SUPABASE_URL. */
export function supabaseAuthUrls(supabaseUrl: string) {
  const origin = new URL(supabaseUrl).origin; // quita "/" o rutas sobrantes
  return {
    issuer: `${origin}/auth/v1`,
    jwksUrl: new URL(`${origin}/auth/v1/.well-known/jwks.json`),
  };
}

/** Claves reales: se descargan del JWKS y jose las guarda en caché. */
export function remoteKeys(jwksUrl: URL): JWTVerifyGetKey {
  return createRemoteJWKSet(jwksUrl);
}

/**
 * Envuelve la fuente de claves para distinguir dos problemas muy distintos:
 * - "ninguna clave coincide con el token" → el token es falso → 401
 * - "no pude descargar las claves"        → el problema es nuestro → 503
 */
function distinguirFallasDeRed(keys: JWTVerifyGetKey): JWTVerifyGetKey {
  return async (header, token) => {
    try {
      return await keys(header, token);
    } catch (error) {
      if (error instanceof errors.JWKSNoMatchingKey || error instanceof errors.JWKSMultipleMatchingKeys) {
        throw error;
      }
      throw new AuthError("unavailable", "no se pudo obtener el JWKS", { cause: error });
    }
  };
}

export function createTokenVerifier({ keys, issuer }: { keys: JWTVerifyGetKey; issuer: string }): TokenVerifier {
  const getKey = distinguirFallasDeRed(keys);

  return async (token) => {
    let sub: string | undefined;
    try {
      const { payload } = await jwtVerify(token, getKey, {
        algorithms: ["ES256"], // solo ES256: bloquea "alg: none" y HS256
        issuer, // emitido por NUESTRO proyecto
        audience: "authenticated", // token de usuario con sesión
        clockTolerance: 30, // segundos de margen por relojes desfasados
        requiredClaims: ["sub", "exp"],
      });
      sub = payload.sub;
    } catch (error) {
      if (error instanceof AuthError) throw error; // 503 de arriba
      // Cualquier otra falla (firma, expiración, iss, aud, alg, formato) es culpa del token.
      // El mensaje de jose dice QUÉ falló (p. ej. 'unexpected "aud" claim value'), sin incluir el token.
      const reason = error instanceof errors.JOSEError ? `${error.code}: ${error.message}` : "token ilegible";
      throw new AuthError("unauthenticated", reason, { cause: error });
    }

    if (!sub || !UUID.test(sub)) {
      throw new AuthError("unauthenticated", "sub no es un UUID");
    }
    return { userId: sub };
  };
}
