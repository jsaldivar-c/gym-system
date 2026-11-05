# 0001. Monorepo con `web/` y `api/` separados

- **Estado:** Aceptado
- **Fecha:** 2026-10-31

## Contexto
El sistema tiene un frontend (lo que usa el staff) y un backend (reglas de negocio y acceso a la BD). Lo desarrolla una sola persona que está aprendiendo, y debe poder crecer.

## Decisión
Un solo repositorio de Git con dos aplicaciones independientes: `web/` y `api/`. Cada una tiene su propio `package.json`, y la documentación vive en `docs/`.

## Alternativas consideradas
- **Dos repositorios (polyrepo):** cada uno con su propio ciclo de vida. A cambio, un cambio que toca el front y la API requiere dos PRs coordinados, y hay que duplicar la CI. Es demasiada fricción para una persona.
- **Una sola app (Next.js full stack):** se descarta en el [ADR 0002](0002-react-vite-sobre-nextjs.md).
- **Monorepo con herramientas (Turborepo, Nx):** útil con muchos paquetes. Hoy sería complejidad sin beneficio; se puede agregar después sin mover archivos.

## Consecuencias
- ✅ Un PR puede incluir "endpoint + pantalla" juntos, y se revisan como una unidad.
- ✅ Una sola CI, una sola documentación y un historial de Git único.
- ✅ La separación física impide importar por accidente código del servidor en el navegador.
- ⚠️ Hay que instalar dependencias en dos carpetas. Si molesta, más adelante se pueden usar *npm workspaces*.

## En una entrevista
"Usé un monorepo con frontend y backend como apps separadas: así tengo PRs atómicos y una sola CI, pero mantengo una frontera clara para que las credenciales y el ORM nunca lleguen al cliente."
