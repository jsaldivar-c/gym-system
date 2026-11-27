// Contrato de la query de GET /reportes/ingresos (spec 0008).
import { z } from "zod";
import { diasEntre } from "../lib/fechas.js";
import { fecha } from "./comunes.js";

export const MAX_DIAS_RANGO = 366; // un año, aunque sea bisiesto

/** "?desde=" vacío = no vino. */
const fechaOpcional = z.preprocess((v) => (v === "" ? undefined : v), fecha(() => null).optional());

/** Los valores por defecto dependen de "hoy" en la zona del gimnasio: el esquema se arma por petición. */
export function esquemaIngresos(hoy: string) {
  return z.object({ desde: fechaOpcional, hasta: fechaOpcional }).transform(({ desde, hasta: hastaQuery }, ctx) => {
    const hasta = hastaQuery ?? hoy;
    const inicio = desde ?? `${hasta.slice(0, 8)}01`; // el día 1 del mes de `hasta`
    const dias = diasEntre(inicio, hasta) + 1; // los dos extremos cuentan
    const mensaje =
      dias < 1 ? "Debe ser igual o posterior a desde" : dias > MAX_DIAS_RANGO ? `El rango no puede ser de más de ${MAX_DIAS_RANGO} días` : null;
    if (mensaje) {
      ctx.addIssue({ code: "custom", path: ["hasta"], message: mensaje });
      return z.NEVER;
    }
    return { desde: inicio, hasta };
  });
}

export type IngresosQuery = z.infer<ReturnType<typeof esquemaIngresos>>;
