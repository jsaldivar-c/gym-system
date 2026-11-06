# Architecture Decision Records (ADR)

Un ADR documenta **una** decisión de arquitectura: el contexto, lo que se decidió, las alternativas descartadas y sus consecuencias.

**¿Por qué?** Dentro de 6 meses nadie (ni tú) recordará por qué se eligió Express y no Next. El ADR responde eso en 2 minutos. Además, es una práctica real de equipos profesionales y un excelente material para entrevistas.

**Reglas:**
- Un ADR aceptado no se edita: si la decisión cambia, se escribe uno nuevo que lo reemplaza (`Estado: Reemplazado por 00XX`).
- Numeración consecutiva: `NNNN-titulo-en-kebab-case.md`.
- Para uno nuevo, copia [`plantilla.md`](plantilla.md).

| # | Decisión | Estado |
|---|---|---|
| [0001](0001-monorepo.md) | Monorepo con `web/` y `api/` separados | Aceptado |
| [0002](0002-react-vite-sobre-nextjs.md) | React + Vite en lugar de Next.js | Aceptado |
| [0003](0003-supabase-y-prisma.md) | Supabase (PostgreSQL) + Prisma | Aceptado |
| [0004](0004-api-express-typescript.md) | API con Node + Express + TypeScript | Aceptado |
| [0005](0005-autenticacion-y-seguridad.md) | Supabase Auth, JWT, RLS y multi-tenant | Aceptado |
