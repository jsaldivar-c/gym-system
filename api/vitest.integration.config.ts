// Config de `npm run test:integration`: tests contra un Postgres REAL (ver docker-compose.test.yml).
// globalSetup corre UNA vez antes de todos los archivos: deja la BD vacía y con las migraciones aplicadas.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Hablar con una BD es más lento que con un objeto en memoria
    testTimeout: 15_000,
    hookTimeout: 120_000,
  },
});
