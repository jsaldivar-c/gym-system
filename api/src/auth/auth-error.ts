// Un solo tipo de error para todo lo que puede salir mal al autenticar.
// `kind` decide el código HTTP; `reason` es el motivo exacto, que SOLO va al log (spec 0002).

export type AuthErrorKind =
  | "unauthenticated" // 401: no sé quién eres
  | "forbidden" // 403: sé quién eres, pero no puedes
  | "unavailable"; // 503: no puedo verificar ahora (Supabase no responde)

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    readonly reason: string,
    options?: { cause?: unknown },
  ) {
    super(`${kind}: ${reason}`, options);
    this.name = "AuthError";
  }
}
