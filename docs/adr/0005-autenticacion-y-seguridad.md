# 0005. Supabase Auth, JWT, RLS y aislamiento por gimnasio

- **Estado:** Aceptado
- **Fecha:** 2026-10-31

## Contexto
El sistema guarda datos personales (LFPDPPP 2025) y dinero. Hay dos roles con permisos distintos, y en el futuro habrá varios gimnasios que no deben ver los datos de los otros.

## Decisión

**Autenticación (¿quién eres?)**
- **Supabase Auth** maneja el login del staff: hashing de contraseñas, sesiones y recuperación. No se programa un login propio.
- `web/` obtiene un **JWT** (token firmado) y lo envía en cada petición: `Authorization: Bearer <token>`.
- `api/` **verifica la firma** del JWT con las claves públicas de Supabase (JWKS) antes de hacer cualquier cosa.

**Autorización (¿qué puedes hacer?)**
- Un middleware carga el `perfiles_staff` del usuario y obtiene su `rol` y su `gimnasio_id`.
- **Toda consulta filtra por el `gimnasio_id` del perfil, nunca por uno que venga en la petición.**
- Las acciones sensibles (anular pagos, cambiar precios) exigen el rol `DUENO`.

**Defensa en profundidad**
- **RLS activado en todas las tablas** y sin políticas para `anon` ni `authenticated`: aunque la `anon key` (que es pública) se use para leer directo, Supabase no devuelve nada. Solo la API, con su conexión privada, accede a los datos.
- Validación de toda entrada con **Zod**.
- `helmet` (cabeceras de seguridad), **CORS** limitado al dominio de `web/` y **rate limiting**.
- Los errores en producción no muestran el stack trace.
- `CHECK` y FKs en la BD como última barrera.

**Secretos**
- En `.env`, que está en `.gitignore`. El repositorio solo tiene `.env.example`.
- La `service_role key` y la `DATABASE_URL` **solo** existen en `api/`. `web/` solo conoce la `anon key` y la URL pública de Supabase.
- GitHub: Dependabot y *secret scanning* activos.

## Alternativas consideradas
- **Login propio (bcrypt + sesiones):** es educativo, pero propenso a errores graves y no aporta valor de negocio.
- **Confiar solo en RLS, sin API:** es válido en Supabase, pero las reglas de negocio quedarían repartidas entre SQL y frontend.
- **Una base de datos por gimnasio:** máximo aislamiento, pero las migraciones y el costo se multiplican. Se puede evaluar si algún cliente lo exige.

## Consecuencias
- ✅ Un recepcionista del gimnasio A nunca puede leer datos del gimnasio B, aunque manipule la petición.
- ✅ Si se filtra la `anon key`, RLS bloquea el acceso.
- ⚠️ Hay que acordarse de filtrar por `gimnasio_id` en cada repositorio. Se mitiga con un helper obligatorio y tests de aislamiento.

## En una entrevista
"Separé autenticación de autorización: Supabase emite el JWT y mi API lo verifica, y después aplico rol y tenant desde el perfil del servidor, nunca desde datos del cliente. Agregué RLS como segunda capa para que una llave filtrada no exponga datos."
