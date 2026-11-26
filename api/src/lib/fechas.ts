// Fechas de calendario (columnas `date`): un día, sin hora ni zona horaria (spec 0004).
// En la API viajan como texto "YYYY-MM-DD". Este módulo es el único que las convierte.

const FORMATO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "Hoy" en la zona horaria del gimnasio, como "YYYY-MM-DD". El servidor puede estar en UTC. */
export function hoyEn(zonaHoraria: string, ahora: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD; timeZone hace la conversión de zona.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** ¿Es "YYYY-MM-DD" y además un día que existe? ("2026-02-30" tiene el formato, pero no existe.) */
export function esFechaReal(valor: string): boolean {
  const partes = FORMATO.exec(valor);
  if (!partes) return false;
  const [, y, m, d] = partes.map(Number) as [number, number, number, number];
  const fecha = new Date(Date.UTC(y, m - 1, d));
  // Date "corrige" los días inválidos (30 de febrero → 2 de marzo): si cambió, no existía.
  return fecha.getUTCFullYear() === y && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

/** Resta años a una fecha "YYYY-MM-DD". Como texto con el mismo formato, se compara con < y >. */
export function restarAnios(fecha: string, anios: number): string {
  const anio = Number(fecha.slice(0, 4)) - anios;
  return `${String(anio).padStart(4, "0")}${fecha.slice(4)}`;
}

/** "YYYY-MM-DD" → Date a medianoche UTC, que es como Prisma escribe una columna `date`. */
export function aDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

/** Date que devuelve Prisma para una columna `date` (medianoche UTC) → "YYYY-MM-DD". */
export function deDate(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

function partes(fecha: string): [number, number, number] {
  return [Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), Number(fecha.slice(8, 10))];
}

/** Suma (o resta, con negativos) días a una fecha "YYYY-MM-DD". Date.UTC se encarga de cambiar de mes y de año. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = partes(fecha);
  return deDate(new Date(Date.UTC(y, m - 1, d + dias)));
}

/**
 * Último día INCLUIDO de un periodo de `meses` que empieza en `inicio` (spec 0005):
 * el mismo día N meses después, menos uno. Si ese día no existe (31 de abril), se usa
 * el 1 del mes siguiente. No usamos setMonth porque "se pasa": 31 ene + 1 mes = 3 mar.
 */
export function calcularFechaFin(inicio: string, meses: number): string {
  const [y, m, d] = partes(inicio);
  const destino = m - 1 + meses; // mes en base 0; Date.UTC acepta 12, 13… y avanza el año
  const diasDelMes = new Date(Date.UTC(y, destino + 1, 0)).getUTCDate(); // día 0 del mes siguiente = último de este
  const siguiente = d <= diasDelMes ? Date.UTC(y, destino, d) : Date.UTC(y, destino + 1, 1);
  return deDate(new Date(siguiente - UN_DIA_MS));
}
