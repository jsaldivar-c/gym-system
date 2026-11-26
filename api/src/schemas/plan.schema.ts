// Contrato de entrada de /planes (spec 0003). Zod valida en tiempo de ejecución
// Y genera los tipos de TypeScript: una sola fuente de verdad para ambos.
import { z } from "zod";

// "500", "500.5" o "500.00": hasta 8 enteros (numeric(10,2)) y hasta 2 decimales. Sin signo.
const MONTO = /^\d{1,8}(\.\d{1,2})?$/;

const nombre = z
  .string({ error: "Debe ser texto" })
  .trim()
  .min(1, "Es obligatorio")
  .max(60, "Debe tener como máximo 60 caracteres");

/** "0500.5" → "500.50", sin pasar por float (así "500" y "500.00" se comparan como iguales). */
function normalizarMonto(valor: string): string {
  const [enteros = "0", decimales = ""] = valor.split(".");
  return `${BigInt(enteros)}.${decimales.padEnd(2, "0")}`;
}

const precio = z
  .string({ error: 'Debe ser texto, por ejemplo "500.00"' })
  .regex(MONTO, 'Debe ser un monto con hasta 2 decimales, por ejemplo "500.00"')
  .transform(normalizarMonto)
  .refine((v) => v !== "0.00", "Debe ser mayor que 0");

const duracionMeses = z
  .number({ error: "Debe ser un número" })
  .int("Debe ser un número entero")
  .min(1, "Debe estar entre 1 y 24")
  .max(24, "Debe estar entre 1 y 24");

const activo = z.boolean({ error: "Debe ser true o false" });

// strictObject: un campo que no esté aquí (p. ej. gimnasioId) → 400. Evita la asignación masiva.
export const crearPlanSchema = z.strictObject({ nombre, precio, duracionMeses });

export const actualizarPlanSchema = z
  .strictObject({
    nombre: nombre.optional(),
    precio: precio.optional(),
    duracionMeses: duracionMeses.optional(),
    activo: activo.optional(),
  })
  .refine((datos) => Object.keys(datos).length > 0, "Envía al menos un campo para cambiar");

export type CrearPlanInput = z.infer<typeof crearPlanSchema>;
export type ActualizarPlanInput = z.infer<typeof actualizarPlanSchema>;
