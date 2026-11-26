// Puente entre Zod y nuestros errores: valida y devuelve datos TIPADOS, o lanza ValidationError.
import type { z } from "zod";
import { ValidationError } from "../errors.js";

export function validar<S extends z.ZodType>(schema: S, datos: unknown): z.infer<S> {
  const resultado = schema.safeParse(datos);
  if (resultado.success) return resultado.data;

  throw new ValidationError(
    resultado.error.issues.flatMap((issue) => {
      // Campos que no están en el contrato (strictObject): un detalle por cada uno
      if (issue.code === "unrecognized_keys") {
        // Con la ruta del objeto donde apareció: "contactoEmergencia.edad"
        return issue.keys.map((key) => ({ campo: [...issue.path, key].join("."), mensaje: "Campo no permitido" }));
      }
      // path vacío = el problema es el body completo
      if (issue.path.length === 0) {
        const mensaje = issue.code === "invalid_type" ? "El cuerpo debe ser un objeto JSON" : issue.message;
        return [{ campo: "body", mensaje }];
      }
      return [{ campo: issue.path.join("."), mensaje: issue.message }];
    }),
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}
