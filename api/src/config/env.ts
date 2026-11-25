// Lee y valida las variables de entorno UNA vez, al arrancar.
// Si falta algo, la API no arranca: es mejor fallar pronto que fallar en la primera petición.

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa api/.env (copia .env.example).`);
  }
  return valor;
}

export interface Env {
  databaseUrl: string;
  supabaseUrl: string;
  webOrigin: string;
  port: number;
}

export function loadEnv(): Env {
  const port = Number(process.env["PORT"] ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT inválido: "${process.env["PORT"]}"`);
  }

  return {
    databaseUrl: requerida("DATABASE_URL"),
    supabaseUrl: requerida("SUPABASE_URL"),
    webOrigin: requerida("WEB_ORIGIN"),
    port,
  };
}
