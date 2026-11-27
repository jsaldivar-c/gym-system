// Repositorio de clientes: la única capa que consulta `clientes` con Prisma.
// REGLA (ADR 0005): cada método recibe el gimnasioId y lo pone en el WHERE. Sin excepción.
import { ConflictError } from "../errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { aDate, deDate } from "../lib/fechas.js";
import type { Estado, EstadoCliente } from "./membresia.repository.js";

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

/** El cliente con su semáforo (spec 0006), tal como lo calcula la vista v_estado_clientes. */
export interface ClienteConEstado extends Cliente {
  estado: EstadoCliente;
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
    opciones: { busqueda?: Busqueda; estado?: Estado; pagina: number; porPagina: number },
  ): Promise<{ clientes: ClienteConEstado[]; total: number }>;
  buscarPorId(gimnasioId: string, id: string): Promise<Cliente | null>;
  /** Como buscarPorId, pero con el estado de la vista (para la ficha). */
  buscarConEstado(gimnasioId: string, id: string): Promise<ClienteConEstado | null>;
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
 * En LIKE '%texto%', el "%" y el "_" del texto serían comodines:
 * sin esto, buscar "%" encontraría a todos. Se escapan con "\", el escape por defecto de LIKE.
 */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Las columnas de la consulta con estado. Los alias entre comillas ya tienen el nombre de la propiedad;
 * ::text deja las fechas como "YYYY-MM-DD" (sin pasar por Date ni zonas horarias) y ::int da un número.
 */
const COLUMNAS_CON_ESTADO = Prisma.sql`
  c.id, c.nombres, c.apellidos, c.telefono, c.email,
  c.fecha_nacimiento::text AS "fechaNacimiento",
  c.fecha_inscripcion::text AS "fechaInscripcion",
  c.contacto_emergencia_nombre AS "contactoEmergenciaNombre",
  c.contacto_emergencia_telefono AS "contactoEmergenciaTelefono",
  c.contacto_emergencia_parentesco AS "contactoEmergenciaParentesco",
  c.notas,
  v.estado,
  v.dias_restantes::int AS "diasRestantes",
  v.fecha_fin::text AS "fechaFin",
  v.membresia_id AS "membresiaId"`;

/** Prisma no puede hacer JOIN con una vista que no está en el esquema: por eso esta parte es SQL. */
const DESDE_CON_ESTADO = Prisma.sql`FROM clientes c JOIN v_estado_clientes v ON v.cliente_id = c.id`;

type FilaConEstado = Cliente & EstadoCliente;

function aClienteConEstado({ estado, diasRestantes, fechaFin, membresiaId, ...cliente }: FilaConEstado): ClienteConEstado {
  return { ...cliente, estado: { estado, diasRestantes, fechaFin, membresiaId } };
}

/**
 * El WHERE de la lista, armado con fragmentos Prisma.sql: cada valor viaja como PARÁMETRO ($1, $2…),
 * nunca pegado al texto del SQL. Eso es lo que impide la inyección SQL.
 */
function whereDeLista(gimnasioId: string, busqueda: Busqueda | undefined, estado: Estado | undefined) {
  // Los bloqueados (LFPDPPP) no se muestran ni se cuentan. (La vista ya los excluye; se deja escrito.)
  const condiciones = [Prisma.sql`c.gimnasio_id = ${gimnasioId}::uuid`, Prisma.sql`c.estado_registro = 'ACTIVO'`];
  if (busqueda && "telefono" in busqueda) {
    condiciones.push(Prisma.sql`c.telefono LIKE ${`%${escaparLike(busqueda.telefono)}%`}`);
  } else if (busqueda) {
    // Cada palabra debe aparecer en nombres O en apellidos: "ana lop" → Ana López. ILIKE = sin distinguir mayúsculas.
    for (const palabra of busqueda.palabras) {
      const patron = `%${escaparLike(palabra)}%`;
      condiciones.push(Prisma.sql`(c.nombres ILIKE ${patron} OR c.apellidos ILIKE ${patron})`);
    }
  }
  if (estado) condiciones.push(Prisma.sql`v.estado = ${estado}`);
  return Prisma.sql`WHERE ${Prisma.join(condiciones, " AND ")}`;
}

/** Postgres 23505 = violación de UNIQUE (aquí, gimnasio + teléfono). Prisma la reporta como P2002. */
function esTelefonoDuplicado(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const telefonoDuplicado = (telefono: string | undefined) => new ConflictError(`Ya existe un cliente con el teléfono ${telefono}`);

export function createClienteRepository(prisma: PrismaClient): ClienteRepository {
  return {
    async listar(gimnasioId, { busqueda, estado, pagina, porPagina }) {
      const where = whereDeLista(gimnasioId, busqueda, estado);
      // Las dos consultas en una transacción: el total corresponde a la misma "foto" que la página.
      const [filas, conteo] = await prisma.$transaction([
        // c.id al final: orden estable entre páginas aunque se repitan nombres.
        prisma.$queryRaw<FilaConEstado[]>`
          SELECT ${COLUMNAS_CON_ESTADO} ${DESDE_CON_ESTADO} ${where}
          ORDER BY c.apellidos, c.nombres, c.id
          LIMIT ${porPagina}::int OFFSET ${(pagina - 1) * porPagina}::int`,
        prisma.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${DESDE_CON_ESTADO} ${where}`,
      ]);
      return { clientes: filas.map(aClienteConEstado), total: conteo[0]?.total ?? 0 };
    },

    async buscarPorId(gimnasioId, id) {
      const fila = await prisma.cliente.findFirst({ where: { id, gimnasioId, estadoRegistro: "ACTIVO" }, select: SELECT });
      return fila ? aCliente(fila) : null;
    },

    async buscarConEstado(gimnasioId, id) {
      const filas = await prisma.$queryRaw<FilaConEstado[]>`
        SELECT ${COLUMNAS_CON_ESTADO} ${DESDE_CON_ESTADO}
        WHERE c.id = ${id}::uuid AND c.gimnasio_id = ${gimnasioId}::uuid AND c.estado_registro = 'ACTIVO'`;
      return filas[0] ? aClienteConEstado(filas[0]) : null;
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
