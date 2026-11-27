// Controlador de clientes: lee la petición, valida con Zod, llama al servicio y da forma a la respuesta.
import type { Request, Response } from "express";
import { hoyEn } from "../lib/fechas.js";
import { validar } from "../lib/validation.js";
import { getAuth } from "../middlewares/require-auth.js";
import type { Cliente } from "../repositories/cliente.repository.js";
import { esquemasCliente, listarClientesSchema } from "../schemas/cliente.schema.js";
import type { ClienteService } from "../services/cliente.service.js";

/**
 * De las columnas planas a la forma del contrato: el contacto de emergencia va agrupado.
 * Genérica (`T extends Cliente`): si el cliente trae `estado` (spec 0006), pasa tal cual en `resto`.
 */
export function presentarCliente<T extends Cliente>({
  contactoEmergenciaNombre: nombre,
  contactoEmergenciaTelefono: telefono,
  contactoEmergenciaParentesco: parentesco,
  ...resto
}: T) {
  const sinContacto = nombre === null && telefono === null && parentesco === null;
  return { ...resto, contactoEmergencia: sinContacto ? null : { nombre, telefono, parentesco } };
}

/** `ahora` se inyecta para que los tests controlen qué día es "hoy". */
export function createClienteController(service: ClienteService, ahora: () => Date = () => new Date()) {
  /** Los esquemas dependen de "hoy" en la zona del gimnasio de quien hace la petición. */
  const esquemas = (req: Request) => esquemasCliente(hoyEn(getAuth(req).zonaHoraria, ahora()));

  return {
    async listar(req: Request, res: Response) {
      const query = validar(listarClientesSchema, req.query);
      const { clientes, pagina, porPagina, total } = await service.listar(getAuth(req), query);
      res.json({ data: clientes.map(presentarCliente), meta: { pagina, porPagina, total } });
    },

    async obtener(req: Request<{ id: string }>, res: Response) {
      res.json(presentarCliente(await service.obtener(getAuth(req), req.params.id)));
    },

    async crear(req: Request, res: Response) {
      const datos = validar(esquemas(req).crear, req.body);
      const cliente = await service.crear(getAuth(req), datos);
      res.status(201).location(`/clientes/${cliente.id}`).json(presentarCliente(cliente));
    },

    async actualizar(req: Request<{ id: string }>, res: Response) {
      const datos = validar(esquemas(req).actualizar, req.body);
      res.json(presentarCliente(await service.actualizar(getAuth(req), req.params.id, datos)));
    },
  };
}
