# 0002. Autenticación y perfil del staff en la API

- **Estado:** Implementada
- **Fecha:** 2026-11-24
- **Relacionado:** [ADR 0005](../adr/0005-autenticacion-y-seguridad.md), [Spec 0001](0001-api-health.md), [Modelo de datos: `perfiles_staff`](../modelo-datos.md#perfiles_staff)

## Objetivo

Que cada petición a la API sepa **quién la hace**, **de qué gimnasio es** y **qué rol tiene**, antes de tocar cualquier dato. Es la base de todos los endpoints de la fase 1: clientes, pagos, dashboard, etc.

Esta spec cubre tres piezas:
1. El middleware **`requireAuth`**: verifica el token y carga el perfil.
2. El middleware **`requireRole(...)`**: exige ciertos roles.
3. El endpoint **`GET /me`**: devuelve el perfil del usuario. Sirve para probar todo de punta a punta, y el frontend lo usará al iniciar sesión.

**No** incluye el login. Ese lo hace Supabase Auth desde `web/`, y la API solo recibe el token ya emitido.

## Cómo funciona

```
web/  ──login──▶  Supabase Auth  ──emite──▶  JWT (firmado con ES256)
web/  ──GET /me + Authorization: Bearer <JWT>──▶  api/
api/  1. verifica la firma con la clave PÚBLICA de Supabase (JWKS)
      2. busca perfiles_staff WHERE id = sub del token
      3. guarda { userId, gimnasioId, rol } en la petición
      4. el controlador responde
```

**¿Por qué la API puede verificar el token sin preguntarle a Supabase?** Supabase firma con una clave **privada** que solo él tiene, y publica la clave **pública** en `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Con la pública se puede comprobar una firma, pero no crear una. Es como el sello de una notaría: cualquiera puede ver si es auténtico, pero solo la notaría puede ponerlo.

La API descarga esas claves una vez y las guarda en caché. No hace una llamada a Supabase en cada petición.

> Verificado el 2026-11-24: el proyecto de desarrollo ya firma con **ES256**. Los proyectos antiguos de Supabase usaban **HS256**, un secreto compartido que tendría que vivir en `api/.env`. Esta spec **solo acepta ES256**.

## Reglas del token

Un token es válido **solo si cumple todo**:

| Regla | Por qué |
|---|---|
| Llega en la cabecera `Authorization: Bearer <token>` | Nunca en la URL (`?token=`), porque las URLs quedan en logs, historial y cabeceras `Referer` |
| La firma es válida con una clave del JWKS | Nadie pudo fabricarlo ni modificarlo |
| `alg` es `ES256` | Evita el ataque de "cambiar el algoritmo" (por ejemplo, `alg: none`) |
| `iss` = `{SUPABASE_URL}/auth/v1` | Lo emitió **nuestro** proyecto, no otro proyecto de Supabase |
| `aud` = `authenticated` | Es un token de usuario con sesión, no una llave anónima |
| `exp` no ha pasado (tolerancia de 30 s) | Un token robado deja de servir pronto. Supabase los emite con 1 h de vida. La tolerancia cubre relojes desfasados entre servidores |
| `sub` es un UUID | Es el `id` del usuario en `auth.users` |

## Reglas del perfil

Con el token válido, se busca `perfiles_staff` por `id = sub`:

| Situación | Resultado |
|---|---|
| No existe perfil | `403`: el usuario existe en Auth pero no es staff de ningún gimnasio |
| `activo = false` | `403`: el empleado fue dado de baja |
| Existe y está activo | Continúa, con `req.auth = { userId, gimnasioId, rol, nombre, gimnasioNombre }` |

`nombre` y `gimnasioNombre` van en `req.auth` para que `GET /me` responda sin una segunda consulta: la misma consulta que carga el perfil trae el nombre del gimnasio.

**El perfil se consulta en cada petición, sin caché.** Cuesta una consulta extra, pero si el admin desactiva a un empleado o le cambia el rol, aplica **en la siguiente petición**. Si solo confiáramos en el token, el empleado dado de baja seguiría entrando hasta una hora más.

**Regla de oro del aislamiento (ADR 0005):** el `gimnasioId` que usan los servicios y repositorios sale **solo** de `req.auth`. Nunca del body, la URL ni la query, aunque el cliente lo envíe.

## `requireRole(...roles)`

Va **después** de `requireAuth`. Si `req.auth.rol` no está en la lista, responde `403`.

```ts
router.post("/pagos/:id/anular", requireAuth, requireRole("ADMIN", "DUENO"), controller.anular);
```

En esta spec no hay rutas reales que lo usen. Se prueba con rutas de prueba y se usará desde la spec de pagos.

## Contrato

### `GET /me`

- **Autenticación:** `requireAuth` (cualquier rol).
- **Respuesta `200 OK`:**
  ```json
  {
    "id": "6f1c…",
    "nombre": "Ana López",
    "rol": "RECEPCION",
    "gimnasio": { "id": "9b2e…", "nombre": "Gym Centro" }
  }
  ```
- Lleva `Cache-Control: no-store`, porque son datos personales.

### Errores (cualquier ruta protegida)

| Código | Cuándo | Cuerpo | Extra |
|---|---|---|---|
| `401 Unauthorized` | Falta el token, está mal formado, la firma no es válida, expiró, o `iss`/`aud`/`alg` no coinciden | `{ "error": "Unauthorized" }` | Cabecera `WWW-Authenticate: Bearer` |
| `403 Forbidden` | Token válido, pero sin perfil, con perfil inactivo o con rol insuficiente | `{ "error": "Forbidden" }` | |
| `503 Service Unavailable` | No se pudo descargar el JWKS (Supabase caído) y no hay claves en caché | `{ "error": "Service Unavailable" }` | |

**401 vs 403:** `401` significa "no sé quién eres" (vuelve a iniciar sesión). `403` significa "sé quién eres, pero no puedes" (iniciar sesión otra vez no lo arregla). El frontend reacciona distinto a cada uno: con `401` manda al login y con `403` muestra "no tienes permiso".

## Reglas de seguridad

- ❌ **El mismo mensaje para todos los 401**, y lo mismo para los 403. Si respondiéramos "token expirado" o "usuario sin perfil", le daríamos pistas a un atacante. El motivo exacto va **solo al log del servidor**.
- ❌ El token **nunca** se escribe en el log, ni completo ni en parte.
- ❌ Sin `email` en `/me`: el frontend ya lo tiene en la sesión de Supabase (minimización de datos).
- ✅ Solo se aceptan las claves del JWKS del proyecto configurado en `SUPABASE_URL`.
- ✅ `SUPABASE_URL` pasa a ser **obligatoria**: sin ella, la API no arranca.

## Casos de prueba

Los tests automatizados **no usan Supabase**: generan su propio par de claves ES256 y firman tokens de prueba con ellas. La API recibe ese JWKS de prueba por inyección de dependencias, igual que el repositorio falso del health check.

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `GET /me` con token válido y perfil activo | `200` con `id`, `nombre`, `rol` y `gimnasio` |
| 2 | Sin cabecera `Authorization` | `401` + `WWW-Authenticate: Bearer` |
| 3 | Cabecera sin el prefijo `Bearer ` (por ejemplo `Basic abc`) | `401` |
| 4 | Token con la firma alterada | `401` |
| 5 | Token firmado con **otra** clave (no está en el JWKS) | `401` |
| 6 | Token expirado (más allá de la tolerancia de 30 s) | `401` |
| 7 | Token con `iss` de otro proyecto | `401` |
| 8 | Token con `aud` distinto de `authenticated` (por ejemplo `anon`) | `401` |
| 9 | Token con `alg: none` o `HS256` | `401` |
| 10 | Token válido, pero el usuario no tiene perfil | `403` |
| 11 | Token válido, con perfil `activo = false` | `403` |
| 12 | `requireRole("ADMIN", "DUENO")` con rol `RECEPCION` | `403` |
| 13 | `requireRole("ADMIN", "DUENO")` con rol `DUENO` | Pasa al controlador |
| 14 | El JWKS no responde y no hay caché | `503` |
| 15 | Ningún 401/403/503 incluye el motivo ni el token en el cuerpo | Cuerpo exactamente igual al de la tabla de errores |
| 16 | `GET /me` lleva `Cache-Control: no-store` | ✅ |
| 17 | `GET /health` sigue respondiendo **sin** token | `200` (el health check es público) |

### Prueba manual contra Supabase (una vez, en desarrollo)

1. **Supabase → Authentication → Users → Add user:** crear un usuario de prueba. La contraseña la eliges tú y va a tu gestor de contraseñas.
2. **SQL Editor:** crear un gimnasio de prueba (si no existe) y la fila de `perfiles_staff` con el `id` del usuario.
3. Obtener un token con `POST {SUPABASE_URL}/auth/v1/token?grant_type=password`, usando la *publishable/anon key* (es pública).
4. `GET /me` con ese token → `200`. Cambiar `activo = false` en el SQL Editor → `403` en la siguiente petición, **con el mismo token**.

## Preguntas abiertas (decidir al aprobar)

1. **¿`503` o `401` si el JWKS no responde?** Propuesta: `503`. El problema no es del usuario sino nuestro, y con `401` el frontend lo mandaría al login en un bucle sin arreglar nada (la misma idea de *liveness* vs *readiness* de la spec 0001).
2. **¿Agregar un check `auth` a `/health/ready`** que compruebe que el JWKS responde? Propuesta: **no por ahora**. Si Supabase Auth se cae, la base de datos y los datos siguen disponibles. Mejor anotarlo en "Fuera del alcance".

## Fuera del alcance

- **Login, logout y renovar sesión:** los maneja el SDK de Supabase en `web/`.
- **Crear o desactivar staff desde la API:** tendrá su propia spec (solo `ADMIN`).
- **Registrar los inicios de sesión en la bitácora:** Supabase Auth ya guarda sus propios logs.
- **Un límite de peticiones más estricto para rutas protegidas:** por ahora basta el global.

## En una entrevista

"La API no maneja contraseñas: Supabase Auth emite un JWT firmado con ES256 y mi API lo verifica localmente con la clave pública del JWKS, validando emisor, audiencia, algoritmo y expiración. Después cargo el perfil del empleado en cada petición, así que desactivar a alguien aplica de inmediato sin esperar a que expire su token. El `gimnasio_id` siempre sale del perfil del servidor, nunca de la petición, y distingo `401` de `403` para que el frontend sepa si pedir login o mostrar 'sin permiso'."
