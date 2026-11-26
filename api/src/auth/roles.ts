// Los roles del staff, definidos aquí y no importados de Prisma:
// así los servicios y middlewares no dependen del ORM (ADR 0004).
export const ROLES = ["ADMIN", "DUENO", "RECEPCION"] as const;
export type Rol = (typeof ROLES)[number];

/** Lo que sabemos del usuario después de autenticarlo. Lo llevan todas las peticiones protegidas. */
export interface AuthContext {
  userId: string;
  /** ÚNICA fuente del gimnasio para filtrar consultas. Nunca uses uno que venga en la petición. */
  gimnasioId: string;
  rol: Rol;
  nombre: string;
  gimnasioNombre: string;
  /** Zona IANA del gimnasio (p. ej. "America/Mexico_City"): define qué día es "hoy". */
  zonaHoraria: string;
}
