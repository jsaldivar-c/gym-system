# 0003. Supabase (PostgreSQL) + Prisma

- **Estado:** Aceptado
- **Fecha:** 2026-10-31

## Contexto
Los datos son relacionales: clientes → membresías → pagos. Se necesitan integridad referencial, transacciones (crear una membresía y su pago juntos o ninguno) y un login seguro. El presupuesto inicial es cero.

## Decisión
- **Base de datos:** PostgreSQL alojado en **Supabase**, que tiene un plan gratuito e incluye Auth.
- **Acceso a datos desde la API:** **Prisma ORM**. Su esquema (`schema.prisma`) es la fuente de verdad y genera migraciones versionadas en Git.
- Lo que Prisma no expresa bien (vistas, `CHECK`, RLS, permisos) va en **migraciones SQL manuales** dentro de la misma carpeta de migraciones.

## Alternativas consideradas
- **MongoDB / NoSQL:** flexible, pero los datos de un gimnasio son relacionales por naturaleza. Se perderían FKs y transacciones sencillas.
- **Supabase sin ORM (`supabase-js` desde el navegador):** menos código, pero la lógica de negocio quedaría en el frontend y la seguridad dependería solo de las políticas RLS. Es más fácil equivocarse.
- **PostgreSQL local con Docker:** control total, pero el login, los backups y el hosting habría que resolverlos aparte.
- **Drizzle ORM:** más cercano al SQL y más ligero. Es una opción válida; se prefiere Prisma por su documentación y porque se usa más en ofertas de trabajo.

## Consecuencias
- ✅ PostgreSQL es estándar en la industria: no hay *lock-in*, Supabase es "solo" un Postgres administrado.
- ✅ Prisma genera tipos de TypeScript a partir del esquema: si cambia una columna, el compilador avisa en todo el código.
- ✅ Las migraciones versionadas permiten reconstruir la BD desde cero en cualquier máquina.
- ⚠️ Supabase usa un *pooler* de conexiones: Prisma necesita dos URLs, `DATABASE_URL` (pooler, para la app) y `DIRECT_URL` (directa, para migraciones).
- ⚠️ El plan gratuito pausa el proyecto tras una semana sin uso. Para producción real conviene el plan Pro.

## En una entrevista
"Usé PostgreSQL porque el dominio es relacional y necesito integridad y transacciones. Prisma me da migraciones versionadas y tipos generados; las reglas que el ORM no expresa, como `CHECK`, vistas y RLS, las puse en migraciones SQL para que la base de datos se defienda sola."
