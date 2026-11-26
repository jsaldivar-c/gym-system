// De dónde sale la BD de pruebas. Lo comparten el setup global y los tests.

/** Por defecto, el contenedor de docker-compose.test.yml. En la CI se sobrescribe con TEST_DATABASE_URL. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/gym_test";

/**
 * Freno de seguridad: el setup BORRA la BD entera. Solo se permite contra un Postgres local,
 * para que un TEST_DATABASE_URL mal copiado nunca pueda vaciar la base de Supabase.
 */
export function asegurarBdLocal(url: string): void {
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Los tests de integración solo corren contra un Postgres local, y TEST_DATABASE_URL apunta a "${host}".`);
  }
}
