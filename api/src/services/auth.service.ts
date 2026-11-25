// Servicio de autenticación: token → AuthContext, o un AuthError que explica por qué no.
// No sabe nada de HTTP: el middleware decide qué código de estado corresponde.
import { AuthError } from "../auth/auth-error.js";
import type { AuthContext } from "../auth/roles.js";
import type { TokenVerifier } from "../auth/token-verifier.js";
import type { PerfilStaffRepository } from "../repositories/perfil-staff.repository.js";

export interface AuthService {
  authenticate(token: string): Promise<AuthContext>;
}

export function createAuthService({
  verifyToken,
  perfilRepository,
}: {
  verifyToken: TokenVerifier;
  perfilRepository: PerfilStaffRepository;
}): AuthService {
  return {
    async authenticate(token) {
      const { userId } = await verifyToken(token);

      // Sin caché, a propósito: si desactivan al empleado, aplica en la siguiente petición.
      const perfil = await perfilRepository.findById(userId);
      if (!perfil) throw new AuthError("forbidden", "el usuario no tiene perfil de staff");
      if (!perfil.activo) throw new AuthError("forbidden", "el perfil está inactivo");

      return {
        userId: perfil.id,
        gimnasioId: perfil.gimnasioId,
        rol: perfil.rol,
        nombre: perfil.nombre,
        gimnasioNombre: perfil.gimnasio.nombre,
      };
    },
  };
}
