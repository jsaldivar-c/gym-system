// Piezas de Zod que comparten varios contratos (clientes, membresías…).
import { z } from "zod";
import { esFechaReal } from "../lib/fechas.js";

/** Mensaje de tipo: "Es obligatorio" si no vino o vino null; si vino otra cosa, `otroTipo`. */
export const tipo = (otroTipo: string) => (issue: { input?: unknown }) =>
  issue.input === undefined || issue.input === null ? "Es obligatorio" : otroTipo;

/** Texto obligatorio: sin espacios al inicio ni al final, y sin espacios repetidos en medio. */
export const texto = (max: number) =>
  z
    .string({ error: tipo("Debe ser texto") })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Es obligatorio").max(max, `Debe tener como máximo ${max} caracteres`));

/** Una fecha "YYYY-MM-DD" que existe, más una regla propia (devuelve el mensaje de error, o null). */
export const fecha = (regla: (valor: string) => string | null) =>
  z.string({ error: tipo("Debe ser una fecha con formato AAAA-MM-DD") }).transform((v, ctx) => {
    const mensaje = esFechaReal(v) ? regla(v) : "Debe ser una fecha válida con formato AAAA-MM-DD";
    if (mensaje) {
      ctx.addIssue({ code: "custom", message: mensaje });
      return z.NEVER;
    }
    return v;
  });

/** Opcional y se puede vaciar: no viene = undefined; vacío ("" o null) = null. */
const vacioANull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
export const opcional = <T extends z.ZodType>(schema: T) => z.preprocess(vacioANull, schema.nullable()).optional();
