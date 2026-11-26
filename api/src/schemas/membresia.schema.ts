// Contrato de entrada de POST /clientes/:clienteId/membresias (spec 0005).
import { z } from "zod";
import { restarAnios, sumarDias } from "../lib/fechas.js";
import { esUuid } from "../lib/validation.js";
import { fecha, opcional, texto, tipo } from "./comunes.js";

export const METODOS_PAGO = ["EFECTIVO", "TARJETA", "TRANSFERENCIA"] as const;

/** Los límites de `fechaInicio` dependen de "hoy" en la zona del gimnasio: el esquema se arma por petición. */
export function esquemaContratar(hoy: string) {
  const desde = restarAnios(hoy, 1);
  const hasta = sumarDias(hoy, 60);

  // strictObject: ni el precio ni quién cobra pueden venir del cliente (precioAcordado, monto… → 400).
  return z.strictObject({
    planId: z.string({ error: tipo("Debe ser un id válido") }).refine(esUuid, "Debe ser un id válido"),
    metodo: z.enum(METODOS_PAGO, { error: tipo("Debe ser EFECTIVO, TARJETA o TRANSFERENCIA") }),
    folio: opcional(texto(40)),
    fechaInicio: fecha((v) =>
      v < desde ? "No puede ser de hace más de un año" : v > hasta ? "No puede ser de dentro de más de 60 días" : null,
    ).optional(),
  });
}

export type ContratarInput = z.infer<ReturnType<typeof esquemaContratar>>;
