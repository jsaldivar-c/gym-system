// Servicio de clientes: reglas de negocio de la spec 0004. No sabe nada de Express ni de Prisma.
import type { AuthContext } from "../auth/roles.js";
import { ConflictError, NotFoundError } from "../errors.js";
import { pareceTelefono } from "../lib/telefono.js";
import { esUuid } from "../lib/validation.js";
import type { Busqueda, CamposCliente, Cliente, ClienteRepository } from "../repositories/cliente.repository.js";
import type { ActualizarClienteInput, CrearClienteInput, ListarClientesQuery } from "../schemas/cliente.schema.js";

export interface PaginaDeClientes {
  clientes: Cliente[];
  pagina: number;
  porPagina: number;
  total: number;
}

export interface ClienteService {
  listar(auth: AuthContext, query: ListarClientesQuery): Promise<PaginaDeClientes>;
  obtener(auth: AuthContext, id: string): Promise<Cliente>;
  crear(auth: AuthContext, datos: CrearClienteInput): Promise<Cliente>;
  actualizar(auth: AuthContext, id: string, datos: ActualizarClienteInput): Promise<Cliente>;
}

/** El 409 lleva el id del cliente existente, para que recepción abra su ficha en vez de duplicarlo. */
const telefonoOcupado = (telefono: string, clienteId: string) =>
  new ConflictError(`Ya existe un cliente con el teléfono ${telefono}`, { clienteId });

/** "1234" → busca en el teléfono; "ana lop" → busca cada palabra en el nombre. */
function interpretarBusqueda(buscar: string | undefined): Busqueda | undefined {
  if (!buscar) return undefined;
  if (pareceTelefono(buscar)) return { telefono: buscar.replace(/\D/g, "") };
  return { palabras: buscar.split(/\s+/) };
}

/** Del contrato (contacto de emergencia anidado) a las columnas planas. Solo incluye lo que vino. */
function aCampos(datos: ActualizarClienteInput): Partial<CamposCliente> {
  const { contactoEmergencia, ...resto } = datos;
  if (contactoEmergencia === undefined) return resto;
  // El contacto se reemplaza completo: lo que no venga dentro queda vacío.
  return {
    ...resto,
    contactoEmergenciaNombre: contactoEmergencia?.nombre ?? null,
    contactoEmergenciaTelefono: contactoEmergencia?.telefono ?? null,
    contactoEmergenciaParentesco: contactoEmergencia?.parentesco ?? null,
  };
}

export function createClienteService(repo: ClienteRepository): ClienteService {
  async function obtener(auth: AuthContext, id: string): Promise<Cliente> {
    // Un id que no es UUID no puede existir: 404 sin consultar la BD.
    const cliente = esUuid(id) ? await repo.buscarPorId(auth.gimnasioId, id) : null;
    if (!cliente) throw new NotFoundError("Cliente");
    return cliente;
  }

  return {
    async listar(auth, { buscar, pagina, porPagina }) {
      const { clientes, total } = await repo.listar(auth.gimnasioId, { busqueda: interpretarBusqueda(buscar), pagina, porPagina });
      return { clientes, pagina, porPagina, total };
    },

    obtener,

    async crear(auth, datos) {
      // Todos los campos, con null en los opcionales que no vinieron.
      const { contactoEmergencia, email, fechaNacimiento, notas, ...obligatorios } = datos;
      const campos: CamposCliente = {
        ...obligatorios,
        email: email ?? null,
        fechaNacimiento: fechaNacimiento ?? null,
        contactoEmergenciaNombre: contactoEmergencia?.nombre ?? null,
        contactoEmergenciaTelefono: contactoEmergencia?.telefono ?? null,
        contactoEmergenciaParentesco: contactoEmergencia?.parentesco ?? null,
        notas: notas ?? null,
      };

      // Comprobación amable (mensaje claro + id). El UNIQUE de la BD es la última barrera.
      const existente = await repo.buscarIdPorTelefono(auth.gimnasioId, campos.telefono);
      if (existente) throw telefonoOcupado(campos.telefono, existente);

      return repo.crear(auth.gimnasioId, campos, auth.userId);
    },

    async actualizar(auth, id, datos) {
      const actual = await obtener(auth, id);

      // Solo los campos que de verdad cambian (ya normalizados): eso se guarda en la bitácora.
      const cambios = aCampos(datos);
      const antes: Partial<CamposCliente> = {};
      const despues: Partial<CamposCliente> = {};
      for (const campo of Object.keys(cambios) as (keyof CamposCliente)[]) {
        if (cambios[campo] !== actual[campo]) {
          Object.assign(antes, { [campo]: actual[campo] });
          Object.assign(despues, { [campo]: cambios[campo] });
        }
      }

      if (Object.keys(despues).length === 0) return actual; // nada que cambiar, nada que auditar

      if (despues.telefono) {
        const existente = await repo.buscarIdPorTelefono(auth.gimnasioId, despues.telefono, id);
        if (existente) throw telefonoOcupado(despues.telefono, existente);
      }

      const cliente = await repo.actualizar(auth.gimnasioId, id, { actorId: auth.userId, antes, despues });
      if (!cliente) throw new NotFoundError("Cliente"); // lo bloquearon o movieron entre la lectura y la escritura
      return cliente;
    },
  };
}
