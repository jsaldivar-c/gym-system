// Config de `npm test`: SOLO tests unitarios (sin base de datos, con repositorios falsos).
// Los de integración viven en tests/integration/ y tienen su propia config.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/integration/**"],
  },
});
