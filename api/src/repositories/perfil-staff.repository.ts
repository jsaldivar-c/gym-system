// Repositorio de perfiles del staff: la única capa que consulta perfiles_staff con Prisma.
import type { Rol } from "../auth/roles.js";
import type { PrismaClient } from "../lib/prisma.js";

export interface PerfilStaff {
  id: string;
  gimnasioId: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  gimnasio: { id: string; nombre: string; zonaHoraria: string };
}

export interface PerfilStaffRepository {
  /**
   * Busca por el id de auth.users. Es la ÚNICA consulta que no filtra por gimnasio,
   * porque justo sirve para averiguar a qué gimnasio pertenece el usuario.
   */
  findById(userId: string): Promise<PerfilStaff | null>;
}

export function createPerfilStaffRepository(prisma: PrismaClient): PerfilStaffRepository {
  return {
    findById(userId) {
      return prisma.perfilStaff.findUnique({
        where: { id: userId },
        select: {
          id: true,
          gimnasioId: true,
          nombre: true,
          rol: true,
          activo: true,
          gimnasio: { select: { id: true, nombre: true, zonaHoraria: true } },
        },
      });
    },
  };
}
