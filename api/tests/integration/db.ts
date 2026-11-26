// Utilidades de los tests de integración: el cliente de Prisma de pruebas y "fábricas" de datos.
//
// Estrategia de aislamiento entre tests: NO se borra nada entre un test y otro (la bitácora ni
// siquiera lo permite: es de solo inserción). En su lugar, cada test crea SUS PROPIOS gimnasios
// con ids nuevos. Como todo cuelga de un gimnasio, un test nunca ve los datos de otro.
import { randomUUID } from "node:crypto";
import { afterAll } from "vitest";
import { createPrismaClient } from "../../src/lib/prisma.js";
import { TEST_DATABASE_URL } from "./test-database-url.js";

export const prisma = createPrismaClient(TEST_DATABASE_URL);

// Cada archivo de tests corre en su propio proceso: cierra su pool de conexiones al terminar.
afterAll(() => prisma.$disconnect());

export async function crearGimnasio(nombre = `Gym ${randomUUID().slice(0, 8)}`) {
  return prisma.gimnasio.create({
    data: { nombre, emailNotificaciones: "avisos@gym.test" },
    select: { id: true, nombre: true },
  });
}

/** Un perfil de staff. El id es el de auth.users en Supabase; aquí basta un UUID cualquiera. */
export async function crearStaff(gimnasioId: string, datos: { nombre?: string; rol?: "ADMIN" | "DUENO" | "RECEPCION"; activo?: boolean } = {}) {
  return prisma.perfilStaff.create({
    data: { id: randomUUID(), gimnasioId, nombre: datos.nombre ?? "Ana López", rol: datos.rol ?? "DUENO", activo: datos.activo ?? true },
  });
}

/** Filas de la bitácora de un registro (por defecto, un plan), en orden de creación. */
export function bitacoraDe(gimnasioId: string, entidadId: string, entidad: "planes" | "clientes" = "planes") {
  return prisma.bitacoraAuditoria.findMany({
    where: { gimnasioId, entidad, entidadId },
    orderBy: { id: "asc" },
  });
}
