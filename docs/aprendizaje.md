# Guía de aprendizaje: conceptos para entrevistas

Cada concepto incluye una definición corta, un ejemplo en este proyecto y la frase que dirías en una entrevista. Se va ampliando en cada fase.

---

## Bases de datos

### Llave primaria (PK) y llave foránea (FK)
- **PK:** identifica una fila de forma única (`clientes.id`).
- **FK:** apunta a la PK de otra tabla (`membresias.cliente_id → clientes.id`). La BD impide crear una membresía para un cliente que no existe.
- **Entrevista:** "Las FKs garantizan integridad referencial en la base de datos, no solo en el código."

### Normalización (1FN, 2FN, 3FN)
- **Idea:** cada dato vive en un solo lugar.
- **1FN:** valores atómicos. Nada de una columna `telefonos` con `"555..., 556..."`.
- **2FN y 3FN:** cada columna depende solo de la llave. El precio del plan vive en `planes`, no repetido en cada cliente.
- **En este proyecto:** la "fecha de próximo pago" no se guarda; se deriva de `membresias`.
- **Desnormalización controlada:** `pagos.gimnasio_id` está duplicado a propósito, para filtrar por tenant sin hacer `JOIN`. Romper una regla está bien si sabes por qué lo haces.

### Datos derivados vs datos guardados
- La edad se calcula a partir de `fecha_nacimiento`, y el estado (vencido o activo) a partir de `fecha_fin`.
- **Analogía con React y Lit:** es como un valor calculado en el render, en vez de un `useState` (o un `@property`) que alguien debe mantener sincronizado a mano.

### Índices
- Son como el índice de un libro: evitan leer la tabla completa.
- `UNIQUE(gimnasio_id, telefono)` es a la vez una regla y un índice.
- **Costo:** cada índice hace más lentas las escrituras. Solo se crean los que responden consultas frecuentes.

### Transacciones (ACID)
- **Renovar** = crear la membresía + registrar el pago. Si falla el pago, la membresía tampoco debe quedar. `prisma.$transaction` hace que ocurra "todo o nada".

### Enums y `CHECK`
- Hacen que la BD rechace valores inválidos. Es la última línea de defensa: aunque la API tenga un bug, la BD no acepta `monto = -500`.

### Migraciones
- Son el "Git del esquema": cada cambio a la BD es un archivo versionado y ordenado. Cualquier persona reconstruye la BD con un solo comando.

### Multi-tenant
- Varios clientes (gimnasios) comparten una sola BD, separados por `gimnasio_id`.
- **Alternativas:** un esquema por tenant o una BD por tenant. Ofrecen más aislamiento, pero más costo operativo.

### Soft delete y ciclo de vida de datos
- **Soft delete:** marcar la fila en lugar de borrarla, para conservar el historial.
- La LFPDPPP 2025 pide además **plazos**: `ACTIVO → BLOQUEADO → SUPRIMIDO`. Un "borrado lógico eterno" no equivale a suprimir datos.

---

## Backend y API

### REST
- **Recursos y verbos:** `GET /clientes` (listar), `POST /clientes` (crear), `PATCH /clientes/:id` (modificar parcialmente).
- **Códigos de estado:** `200` OK, `201` creado, `400` datos inválidos, `401` sin login, `403` sin permiso, `404` no existe, `409` conflicto (por ejemplo, un teléfono duplicado).

### Arquitectura en capas
`route → controller → service → repository`
- **Analogía:** en un restaurante, el mesero (controller) toma la orden, el chef (service) decide cómo prepararla y la despensa (repository) entrega los ingredientes. El chef no atiende mesas.

### Middleware
- Es una función que se ejecuta antes del controlador: verificar el token, comprobar el rol, registrar la petición o manejar errores. Se encadenan como filtros.

### Validación con Zod
- TypeScript protege mientras escribes código, pero **desaparece al compilar**. Zod valida los datos reales que llegan por la red, en tiempo de ejecución.

---

## Seguridad

### Autenticación vs autorización
- **Autenticación:** ¿quién eres? (login y JWT).
- **Autorización:** ¿qué puedes hacer? (rol y gimnasio).
- **Analogía:** el gafete te deja entrar al edificio (autenticación), pero no a todas las oficinas (autorización).

### JWT
- Es un token firmado con tres partes: `header.payload.firma`. El servidor verifica la firma, no busca el token en una BD.
- **Ojo:** el payload **no está cifrado**, solo codificado. Nunca se ponen datos sensibles en él.

### RLS (Row Level Security)
- Son reglas en PostgreSQL que deciden qué filas puede ver cada usuario. Aquí se usan como **defensa en profundidad**.

### Defensa en profundidad
- Varias capas independientes: validación en el front, Zod en la API, autorización, RLS y `CHECK` en la BD. Si una falla, otra protege.

### Secretos
- Nunca van en Git. `.env` se ignora y `.env.example` documenta qué variables existen.
- **Si un secreto llega a GitHub, aunque se borre después, se considera comprometido y se rota.**

### OWASP Top 10
- Es la lista de los riesgos web más comunes. Los que este proyecto mitiga desde el inicio:
  - Control de acceso roto (mitigado con el tenant y los roles).
  - Inyección (mitigada con Prisma, que usa consultas parametrizadas).
  - Configuración insegura (mitigada con helmet y CORS).

---

## Git y GitHub

### Flujo con rama protegida
1. `git switch -c feat/alta-clientes`
2. Commits pequeños: `feat(api): crear endpoint POST /clientes`
3. `git push` y abrir el Pull Request.
4. La CI corre: lint, tipos y build.
5. Revisión y merge a `main`. Después se borra la rama.

### ¿Por qué proteger `main`?
- `main` siempre debe funcionar. El PR obliga a revisar y a que pasen las pruebas antes de integrar.
- **En una entrevista:** "Trabajo con *trunk-based development* ligero: ramas cortas, PRs pequeños y CI obligatoria."

### Conventional Commits
- Formato `tipo(ámbito): descripción`. Los tipos son `feat`, `fix`, `docs`, `refactor`, `test` y `chore`.
- Permite generar changelogs y entender el historial de un vistazo.

### CI (Integración Continua)
- GitHub Actions ejecuta comprobaciones automáticas en cada PR, para que ningún error obvio llegue a `main`.

---

## Frontend (se ampliará en la fase 1)

- **SPA:** una sola página HTML. React cambia la vista sin recargar.
- **Estado del servidor vs estado de la UI:** los datos de la API (clientes) los maneja TanStack Query, con caché, recarga y estado de carga. Lo local, como un modal abierto, va en `useState`.
- **React vs LitElement:** el `props` de React equivale a las `@property` de Lit. `useState` equivale a `@state`. El render de React vuelve a ejecutar la función completa, mientras que Lit actualiza las partes del template que cambiaron.
