// Repositorio de clientes: la única capa que consulta `clientes` con Prisma.
// REGLA (ADR 0005): cada método recibe el gimnasioId y lo pone en el WHERE. Sin excepción.
import { ConflictError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { aDate, deDate } from "../lib/fechas.js";

/**
 * Los datos de un cliente tal como los ven los servicios: planos (una propiedad por columna)
 * y con las fechas como "YYYY-MM-DD". La forma anidada de la respuesta la arma el controlador.
 */
export interface CamposCliente {
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string | null;
  fechaNacimiento: string | null;
  fechaInscripcion: string;
  contactoEmergenciaNombre: string | null;
  contactoEmergenciaTelefono: string | null;
  contactoEmergenciaParentesco: string | null;
  notas: string | null;
}

export interface Cliente extends CamposCliente {
  id: string;
}

/** Qué buscar: o por teléfono (dígitos), o por palabras del nombre. Lo decide el servicio. */
export type Busqueda = { telefono: string } | { palabras: string[] };

export interface Auditoria {
  actorId: string;
  antes: Partial<CamposCliente>;
  despues: Partial<CamposCliente>;
}

export interface ClienteRepository {
  listar(
    gimnasioId: string,
    opciones: { busqueda?: Busqueda; pagina: number; porPagina: number },
  ): Promise<{ clientes: Cliente[]; total: number }>;
  buscarPorId(gimnasioId: string, id: string): Promise<Cliente | null>;
  /** El id del cliente activo que ya usa ese teléfono en el gimnasio, o null. */
  buscarIdPorTelefono(gimnasioId: string, telefono: string, excluirId?: string): Promise<string | null>;
  crear(gimnasioId: string, datos: CamposCliente, actorId: string): Promise<Cliente>;
  /** Devuelve null si el cliente no existe (o no está activo) en ESE gimnasio. */
  actualizar(gimnasioId: string, id: string, auditoria: Auditoria): Promise<Cliente | null>;
}

const SELECT = {
  id: true,
  nombres: true,
  apellidos: true,
  telefono: true,
  email: true,
  fechaNacimiento: true,
  fechaInscripcion: true,
  contactoEmergenciaNombre: true,
  contactoEmergenciaTelefono: true,
  contactoEmergenciaParentesco: true,
  notas: true,
} as const satisfies Prisma.ClienteSelect;

type Fila = Prisma.ClienteGetPayload<{ select: typeof SELECT }>;

function aCliente({ fechaNacimiento, fechaInscripcion, ...resto }: Fila): Cliente {
  return { ...resto, fechaNacimiento: fechaNacimiento ? deDate(fechaNacimiento) : null, fechaInscripcion: deDate(fechaInscripcion) };
}

/** Las fechas de texto pasan a Date, que es lo que Prisma espera para una columna `date`. */
function aDatos<T extends Partial<CamposCliente>>({ fechaNacimiento, fechaInscripcion, ...resto }: T) {
  return {
    ...resto,
    ...(fechaNacimiento !== undefined && { fechaNacimiento: fechaNacimiento === null ? null : aDate(fechaNacimiento) }),
    ...(fechaInscripcion !== undefined && { fechaInscripcion: aDate(fechaInscripcion) }),
  };
}

/**
 * Prisma traduce `contains` a LIKE '%texto%' pero NO escapa los comodines del texto:
 * sin esto, buscar "%" encontraría a todos. Se escapan con "\", el escape por defecto de LIKE.
 */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function filtroDeBusqueda(busqueda: Busqueda | undefined): Prisma.ClienteWhereInput {
  if (!busqueda) return {};
  if ("telefono" in busqueda) return { telefono: { contains: escaparLike(busqueda.telefono) } };
  // Cada palabra debe aparecer en nombres O en apellidos: "ana lop" → Ana López.
  return {
    AND: busqueda.palabras.map((palabra) => {
      const contiene = { contains: escaparLike(palabra), mode: "insensitive" as const };
      return { OR: [{ nombres: contiene }, { apellidos: contiene }] };
    }),
  };
}

/** Postgres 23505 = violación de UNIQUE (aquí, gimnasio + teléfono). Prisma la reporta como P2002. */
function esTelefonoDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const telefonoDuplicado = (telefono: string | undefined) => new ConflictError(`Ya existe un cliente con el teléfono ${telefono}`);

export function createClienteRepository(prisma: PrismaClient): ClienteRepository {
  return {
    async listar(gimnasioId, { busqueda, pagina, porPagina }) {
      // Los bloqueados (LFPDPPP) no se muestran ni se cuentan.
      const where: Prisma.ClienteWhereInput = { gimnasioId, estadoRegistro: "ACTIVO", ...filtroDeBusqueda(busqueda) };
      // Las dos consultas en una transacción: el total corresponde a la misma "foto" que la página.
      const [filas, total] = await prisma.$transaction([
        prisma.cliente.findMany({
          where,
          orderBy: [{ apellidos: "asc" }, { nombres: "asc" }, { id: "asc" }], // id: orden estable entre páginas
          skip: (pagina - 1) * porPagina,
          take: porPagina,
          select: SELECT,
        }),
        prisma.cliente.count({ where }),
      ]);
      return { clientes: filas.map(aCliente), total };
    },

    async buscarPorId(gimnasioId, id) {
      const fila = await prisma.cliente.findFirst({ where: { id, gimnasioId, estadoRegistro: "ACTIVO" }, select: SELECT });
      return fila ? aCliente(fila) : null;
    },

    async buscarIdPorTelefono(gimnasioId, telefono, excluirId) {
      const fila = await prisma.cliente.findFirst({
        where: { gimnasioId, telefono, estadoRegistro: "ACTIVO", ...(excluirId ? { NOT: { id: excluirId } } : {}) },
        select: { id: true },
      });
      return fila?.id ?? null;
    },

    async crear(gimnasioId, datos, actorId) {
      try {
        // Transacción: el cliente y su registro en la bitácora se guardan juntos o ninguno.
        return await prisma.$transaction(async (tx) => {
          const cliente = aCliente(await tx.cliente.create({ data: { ...aDatos(datos), gimnasioId }, select: SELECT }));
          const { id, ...campos } = cliente;
          await tx.bitacoraAuditoria.create({
            data: { gimnasioId, actorId, accion: "CREAR", entidad: "clientes", entidadId: id, datosDespues: { ...campos } },
          });
          return cliente;
        });
      } catch (error) {
        // Dos altas simultáneas con el mismo teléfono: la BD detiene la segunda.
        if (esTelefonoDuplicado(error)) throw telefonoDuplicado(datos.telefono);
        throw error;
      }
    },

    async actualizar(gimnasioId, id, { actorId, antes, despues }) {
      try {
        return await prisma.$transaction(async (tx) => {
          // updateMany permite filtrar por id Y gimnasioId. Si es de otro gimnasio, count = 0.
          const { count } = await tx.cliente.updateMany({ where: { id, gimnasioId, estadoRegistro: "ACTIVO" }, data: aDatos(despues) });
          if (count === 0) return null;

          const cliente = aCliente(await tx.cliente.findFirstOrThrow({ where: { id, gimnasioId }, select: SELECT }));
          await tx.bitacoraAuditoria.create({
            data: { gimnasioId, actorId, accion: "ACTUALIZAR", entidad: "clientes", entidadId: id, datosAntes: antes, datosDespues: despues },
          });
          return cliente;
        });
      } catch (error) {
        if (esTelefonoDuplicado(error)) throw telefonoDuplicado(despues.telefono);
        throw error;
      }
    },
  };
}
