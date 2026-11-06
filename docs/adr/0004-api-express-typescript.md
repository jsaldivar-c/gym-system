# 0004. API con Node + Express + TypeScript

- **Estado:** Aceptado
- **Fecha:** 2026-10-31

## Contexto
Prisma y las credenciales de la BD no pueden vivir en el navegador. Hace falta un servidor que valide, aplique las reglas de negocio y hable con la BD. El desarrollador tiene poca experiencia en Node.

## Decisión
Una API REST en `api/` con **Node.js + Express + TypeScript**, organizada en capas:

```
routes/       → define URL y método (GET /clientes)
controllers/  → lee la petición y responde (HTTP)
services/     → reglas de negocio (renovar, anular pago)
repositories/ → consultas con Prisma
schemas/      → validación con Zod
middlewares/  → autenticación, autorización, errores
```

## Alternativas consideradas
- **Fastify / Hono:** más rápidos y modernos, con buen soporte de TypeScript. Express tiene más tutoriales, ejemplos y presencia en entrevistas. Migrar después es viable porque la lógica vive en `services/`.
- **NestJS:** muy estructurado (similar a Angular), pero su curva es alta para un primer backend.
- **Supabase Edge Functions:** útiles para tareas puntuales (el email diario de la fase 1b), pero no para toda la API.

## Consecuencias
- ✅ Las capas separan responsabilidades: los servicios se prueban sin HTTP, y cambiar de framework solo toca `routes` y `controllers`.
- ✅ Zod valida en tiempo de ejecución, y además sus esquemas generan los tipos de TypeScript.
- ⚠️ Express no impone estructura: la disciplina de capas depende de nosotros.

## En una entrevista
"Estructuré la API en capas (rutas, controladores, servicios y repositorios) para que la lógica de negocio no dependa de Express ni de Prisma. Eso la hace testeable y me permitiría cambiar de framework o de ORM tocando solo los bordes."
