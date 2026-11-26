// Normalización de teléfonos de México a 10 dígitos (spec 0004).
// Así "(55) 1234-5678", "+52 55 1234 5678" y "5512345678" son el MISMO teléfono
// para el UNIQUE de la BD, la búsqueda y el botón de WhatsApp.

/** Solo se permiten dígitos y los separadores que la gente escribe de verdad. */
const CARACTERES_PERMITIDOS = /^[\d\s()+.-]+$/;

/** Devuelve los 10 dígitos, o null si no es un teléfono de México válido. */
export function normalizarTelefono(valor: string): string | null {
  if (!CARACTERES_PERMITIDOS.test(valor)) return null; // "55-ABCD-5678"
  const digitos = valor.replace(/\D/g, "");

  if (digitos.length === 10) return digitos;
  if (digitos.length === 12 && digitos.startsWith("52")) return digitos.slice(2); // +52 (lada de México)
  if (digitos.length === 13 && digitos.startsWith("521")) return digitos.slice(3); // +521 (antiguo prefijo de celulares)
  return null; // "1234", "+1 212 555 0100"…
}

/** ¿El texto de búsqueda parece un teléfono? (solo dígitos y separadores, con al menos un dígito) */
export function pareceTelefono(texto: string): boolean {
  return CARACTERES_PERMITIDOS.test(texto) && /\d/.test(texto);
}
