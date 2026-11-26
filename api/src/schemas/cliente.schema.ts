// Contrato de entrada de /clientes (spec 0004). Zod valida Y normaliza:
// lo que sale de aquí ya trae el teléfono en 10 dígitos, el email en minúsculas, etc.
import { z } from "zod";
import { esFechaReal, restarAnios } from "../lib/fechas.js";
import { normalizarTelefono } from "../lib/telefono.js";

/** Mensaje de tipo: "Es obligatorio" si no vino o vino null; si vino otra cosa, `otroTipo`. */
const tipo = (otroTipo: string) => (issue: { input?: unknown }) =>
  issue.input === undefined || issue.input === null ? "Es obligatorio" : otroTipo;

/** Texto obligatorio: sin espacios al inicio ni al final, y sin espacios repetidos en medio. */
const texto = (max: number) =>
  z
    .string({ error: tipo("Debe ser texto") })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, "Es obligatorio").max(max, `Debe tener como máximo ${max} caracteres`));

const telefono = z
  .string({ error: tipo("Debe ser texto") })
  .max(30, "Debe ser un teléfono de 10 dígitos")
  .transform((v, ctx) => {
    const normalizado = normalizarTelefono(v);
    if (normalizado === null) {
      ctx.addIssue({ code: "custom", message: "Debe ser un teléfono de 10 dígitos" });
      return z.NEVER;
    }
    return normalizado;
  });

// El mismo patrón que el CHECK clientes_email_formato_chk de la BD.
const email = z
  .string({ error: tipo("Debe ser texto") })
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().max(254, "Debe tener como máximo 254 caracteres").regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "No es un email válido"));

/** Una fecha "YYYY-MM-DD" que existe, más una regla propia (devuelve el mensaje de error, o null). */
const fecha = (regla: (valor: string) => string | null) =>
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
const opcional = <T extends z.ZodType>(schema: T) => z.preprocess(vacioANull, schema.nullable()).optional();

/**
 * Las reglas de fechas dependen de "hoy" en la zona del gimnasio, así que los esquemas
 * se arman por petición: `esquemasCliente("2026-11-26")`.
 */
export function esquemasCliente(hoy: string) {
  const noFutura = (v: string) => (v > hoy ? "No puede ser una fecha futura" : null);
  const hace120Anios = restarAnios(hoy, 120);

  const fechaNacimiento = fecha((v) => noFutura(v) ?? (v < hace120Anios ? "No puede ser de hace más de 120 años" : null));
  const fechaInscripcion = fecha(noFutura);

  const contactoEmergencia = z.strictObject(
    { nombre: opcional(texto(80)), telefono: opcional(telefono), parentesco: opcional(texto(80)) },
    { error: tipo("Debe ser un objeto") },
  );

  const opcionales = {
    email: opcional(email),
    fechaNacimiento: opcional(fechaNacimiento),
    contactoEmergencia: contactoEmergencia.nullable().optional(),
    notas: opcional(texto(500)),
  };

  // strictObject: un campo que no esté aquí (gimnasioId, estadoRegistro…) → 400. Evita la asignación masiva.
  const crear = z.strictObject({
    nombres: texto(80),
    apellidos: texto(80),
    telefono,
    fechaInscripcion: fechaInscripcion.default(hoy),
    ...opcionales,
  });

  // En PATCH los obligatorios se pueden omitir, pero no vaciar (null → 400).
  const actualizar = z
    .strictObject({
      nombres: texto(80).optional(),
      apellidos: texto(80).optional(),
      telefono: telefono.optional(),
      fechaInscripcion: fechaInscripcion.optional(),
      ...opcionales,
    })
    .refine((datos) => Object.keys(datos).length > 0, "Envía al menos un campo para cambiar");

  return { crear, actualizar };
}

/** Query de GET /clientes. Llega como texto: z.coerce lo convierte a número. */
export const listarClientesSchema = z.object({
  buscar: z
    .string({ error: "Debe ser texto" })
    .trim()
    .max(100, "Debe tener como máximo 100 caracteres")
    .optional()
    .transform((v) => v || undefined), // "?buscar=" = sin búsqueda
  pagina: z.coerce
    .number({ error: "Debe ser un número entero mayor o igual a 1" })
    .int("Debe ser un número entero mayor o igual a 1")
    .min(1, "Debe ser un número entero mayor o igual a 1")
    .default(1),
  porPagina: z.coerce
    .number({ error: "Debe ser un número entero entre 1 y 100" })
    .int("Debe ser un número entero entre 1 y 100")
    .min(1, "Debe ser un número entero entre 1 y 100")
    .max(100, "Debe ser un número entero entre 1 y 100")
    .default(20),
});

type Esquemas = ReturnType<typeof esquemasCliente>;
export type CrearClienteInput = z.infer<Esquemas["crear"]>;
export type ActualizarClienteInput = z.infer<Esquemas["actualizar"]>;
export type ListarClientesQuery = z.infer<typeof listarClientesSchema>;
