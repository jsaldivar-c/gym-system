# gym-system

Sistema de gestión para gimnasios: clientes, membresías, pagos y vencimientos. Empieza con un solo gimnasio y está diseñado para crecer a varios.

## Estado del proyecto

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Documentación, ADRs, repositorio, CI | ✅ Completa |
| 1 | Base de datos (Supabase + Prisma) | ✅ Completa |
| 1 | API (Express + TypeScript) | 🚧 En curso |
| 1 | Frontend (React + Vite) | ⏳ Pendiente |
| 1b–4 | Email diario, inventario, notificaciones, seguimiento | ⏳ Ver [brief](docs/brief.md#4-alcance-por-fases) |

## Estructura

```
gym-system/
├─ web/                Frontend: React + Vite + TypeScript (pendiente)
├─ api/                Backend: Node + Express + TypeScript + Prisma
│  ├─ prisma/
│  │  ├─ schema.prisma     Modelo de datos (fuente de verdad del código)
│  │  ├─ migrations/       Migraciones versionadas (Prisma + SQL manual)
│  │  └─ sql/              Scripts de verificación
│  ├─ src/
│  │  ├─ routes/           URL + método → controlador
│  │  ├─ controllers/      HTTP: lee la petición y responde
│  │  ├─ services/         Reglas de negocio (sin Express ni Prisma)
│  │  ├─ repositories/     Consultas con Prisma (siempre filtran por gimnasio)
│  │  ├─ schemas/          Validación de entrada con Zod
│  │  ├─ middlewares/      requireAuth, requireRole, 404 y errores
│  │  ├─ errors.ts         Errores de dominio → 400, 404 y 409
│  │  ├─ auth/             Verificación del JWT de Supabase, roles y AuthError
│  │  ├─ types/            Tipos que extienden los de Express (req.auth)
│  │  ├─ app.ts            Arma Express con sus dependencias (lo usan los tests)
│  │  └─ server.ts         Punto de entrada: env, Prisma y puerto
│  ├─ tests/               Tests con Vitest + Supertest (fakes/ = repositorios en memoria)
│  └─ prisma.config.ts     Configuración del CLI de Prisma 7
├─ docs/               Brief, modelo de datos, ADRs, guía de aprendizaje e investigación
└─ .github/            Plantilla de PR, CI y Dependabot
```

## Documentación

- [Brief del proyecto](docs/brief.md): visión, usuarios, roles, fases y reglas de negocio
- [Modelo de datos](docs/modelo-datos.md): diagrama ER, diccionario y vista de estado
- [Decisiones de arquitectura (ADRs)](docs/adr/README.md)
- [Guía de aprendizaje](docs/aprendizaje.md)
- [Benchmark de software de gimnasios](docs/reports/Software%20de%20gestión%20de%20gimnasios.md)

## Requisitos

- Node.js 22 o superior
- Un proyecto de [Supabase](https://supabase.com) (plan Free para desarrollo)
- GitHub CLI (`gh`) para el flujo de PRs (opcional)

## Puesta en marcha

### 1. Base de datos en Supabase

1. Crea un proyecto **solo para desarrollo** (por ejemplo `gym-system-dev`):
   - **Data API:** apagada. Solo la API del proyecto accede a los datos.
   - **Automatic RLS:** encendido.
   - **GitHub:** sin conectar. Las migraciones las maneja Prisma.
2. Guarda la contraseña de la BD en tu gestor de contraseñas.

### 2. Variables de entorno

```bash
cd api
npm install
cp .env.example .env
```

Llena `api/.env` con los datos de **Supabase → Connect**:

| Variable | Origen | Uso |
|---|---|---|
| `DATABASE_URL` | Transaction pooler (puerto 6543) + `?pgbouncer=true` | La app en tiempo de ejecución |
| `DIRECT_URL` | Session pooler (puerto 5432) | Migraciones de Prisma |
| `SUPABASE_URL` | URL del proyecto | Verificación de JWT (Auth) |
| `WEB_ORIGIN` | URL del frontend (`http://localhost:5173` en desarrollo) | CORS |
| `PORT` | Opcional (por defecto `3000`) | Puerto de la API |

> `.env` está en `.gitignore`. **Nunca** se sube al repositorio.
> Si la contraseña tiene caracteres especiales (`@ # / ? : %`), hay que codificarlos en la URL (por ejemplo, `@` → `%40`).

### 3. Migraciones

```bash
npx prisma migrate dev      # desarrollo: aplica las migraciones pendientes
npx prisma migrate status   # ver qué migraciones están aplicadas
npx prisma migrate deploy   # producción/CI: solo aplica, nunca genera
```

### 4. Verificar las reglas de la BD

Pega [`api/prisma/sql/verificar-reglas.sql`](api/prisma/sql/verificar-reglas.sql) en **Supabase → SQL Editor** y ejecútalo. Debe terminar con el error intencional `REPORTE … 16 OK, 0 fallos`. Ese error revierte todos los datos de prueba.

### 5. Arrancar la API

```bash
cd api
npm run dev        # desarrollo: recarga al guardar
npm test           # tests (no necesitan BD)
npm run typecheck  # revisar tipos
npm run build      # compilar a dist/
npm start          # correr lo compilado
```

Comprueba que funciona ([spec 0001](docs/specs/0001-api-health.md)):
- `GET http://localhost:3000/health` → `200` si el proceso está vivo.
- `GET http://localhost:3000/health/ready` → `200` si además la BD responde; `503` si no (el motivo sale en la consola del servidor).
- `GET http://localhost:3000/me` → `401` sin token. Con el token de un usuario de staff, devuelve su perfil ([spec 0002](docs/specs/0002-api-autenticacion.md)).

> Si `/health/ready` da `503` con *"tenant/user … not found"* en la consola, el proyecto de Supabase está pausado (el plan Free los pausa tras días sin uso): reactívalo desde el panel de Supabase.

## Cambios al modelo de datos

1. Edita `api/prisma/schema.prisma`.
2. `npx prisma migrate dev --name descripcion --create-only` genera el SQL **sin aplicarlo**.
3. Revisa el `migration.sql` generado.
4. `npx prisma migrate dev` lo aplica.
5. Haz commit del esquema **y** la migración juntos, y actualiza `docs/modelo-datos.md`.

Reglas:
- **Una migración aplicada nunca se edita ni se borra.** Los cambios van en una migración nueva.
- Lo que Prisma no expresa (`CHECK`, vistas, triggers, permisos) va en una migración vacía (`--create-only`) escrita a mano.

## Flujo de trabajo

`main` está protegida: todo cambio entra por Pull Request con la CI en verde y la rama al día.

1. `git switch main && git pull`
2. `git switch -c tipo/descripcion-corta` (`feat/`, `fix/`, `docs/`, `chore/`)
3. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(api): ...`, `docs: ...`
4. `git push -u origin tipo/descripcion-corta`
5. `gh pr create --base main --fill`
6. Cuando la CI pase: **Squash and merge** y borrar la rama
7. `git switch main && git pull && git branch -D tipo/descripcion-corta`

### Dependencias (Dependabot)

Dependabot abre PRs semanales. Antes de integrarlos:
- **PATCH y MINOR:** aceptar si la CI pasa.
- **MAJOR:** leer el changelog buscando *breaking changes* que afecten nuestro uso.
- Si el PR está atrasado: `gh pr update-branch <n> --rebase` → `gh pr checks <n> --watch` → `gh pr merge <n> --squash --delete-branch`.
- Si cambia `package-lock.json`, ejecutar `npm install` después del `git pull`.
