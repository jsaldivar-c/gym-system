// Dinero sin float. En la API viaja como texto "1500.00"; para sumar se pasa a CENTAVOS enteros (BigInt).
// ¿Por qué? En JavaScript 0.1 + 0.2 = 0.30000000000000004. Con centavos: 10n + 20n = 30n, exacto.

const FORMATO = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "1500.5" → 150050n. Solo montos no negativos, como los de la BD (CHECK monto > 0). */
export function aCentavos(monto: string): bigint {
  const partes = FORMATO.exec(monto);
  if (!partes) throw new Error(`Monto con formato inválido: ${monto}`);
  const enteros = partes[1] ?? "0";
  const decimales = partes[2] ?? "";
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, "0"));
}

/** 150050n → "1500.50" */
export function deCentavos(centavos: bigint): string {
  return `${centavos / 100n}.${(centavos % 100n).toString().padStart(2, "0")}`;
}
