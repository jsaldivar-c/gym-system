// Le enseña a TypeScript que las peticiones de Express pueden llevar `auth`.
// Es "declaration merging": se agrega un campo a una interfaz que no es nuestra.
import type { AuthContext } from "../auth/roles.js";

declare global {
  namespace Express {
    interface Request {
      /** Lo llena requireAuth. Úsalo con getAuth(req), no directamente. */
      auth?: AuthContext;
    }
  }
}

export {};
