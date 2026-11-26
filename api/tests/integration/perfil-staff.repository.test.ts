// Tests de integración del repositorio REAL de perfiles del staff (lo usa el login: spec 0002).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPerfilStaffRepository } from "../../src/repositories/perfil-staff.repository.js";
import { crearGimnasio, crearStaff, prisma } from "./db.js";

const repo = createPerfilStaffRepository(prisma);

describe("findById", () => {
  it("devuelve el perfil con su gimnasio (id y nombre) y nada más", async () => {
    const gimnasio = await crearGimnasio("Gym Centro");
    const staff = await crearStaff(gimnasio.id, { nombre: "Luis Pérez", rol: "RECEPCION", activo: false });

    expect(await repo.findById(staff.id)).toEqual({
      id: staff.id,
      gimnasioId: gimnasio.id,
      nombre: "Luis Pérez",
      rol: "RECEPCION",
      activo: false,
      gimnasio: { id: gimnasio.id, nombre: "Gym Centro" },
    });
  });

  it("un usuario sin perfil (existe en Auth pero no es staff) devuelve null", async () => {
    expect(await repo.findById(randomUUID())).toBeNull();
  });
});
