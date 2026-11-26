# 0003. Planes del gimnasio

- **Estado:** Implementada
- **Fecha:** 2026-11-25
- **Relacionado:** [Spec 0002](0002-api-autenticacion.md), [Brief: usuarios y reglas](../brief.md#3-usuarios), [Modelo de datos: `planes`](../modelo-datos.md#planes), [ADR 0004](../adr/0004-api-express-typescript.md)

## Objetivo

Administrar los **planes** que vende el gimnasio ("Mensual", "Trimestral"…), cada uno con su precio y duración. Es el primer recurso de negocio de la API y el más sencillo, y lo necesitan las membresías: no se puede inscribir a un cliente sin elegir un plan.

Como es el primer CRUD, esta spec también fija **tres patrones que reusarán todos los recursos siguientes**:
1. **Validación con Zod** y un formato único para los errores `400`.
2. **Aislamiento por gimnasio** en cada consulta del repositorio.
3. **Bitácora de auditoría** en la misma transacción que el cambio.

## Quién puede hacer qué

| Acción | `ADMIN` | `DUENO` | `RECEPCION` |
|---|:-:|:-:|:-:|
| Ver planes (para cobrar e inscribir) | ✅ | ✅ | ✅ |
| Crear planes | ✅ | ✅ | ❌ |
| Cambiar nombre, precio o duración, y activar o desactivar | ✅ | ✅ | ❌ |

Viene del [brief](../brief.md#3-usuarios): *"Cambiar precios y planes"* es de `ADMIN` y `DUENO`.

## Reglas de negocio

- **Un plan no se borra, se desactiva** (`activo = false`). Hay membresías que lo usan, y la BD lo impide con `ON DELETE RESTRICT`. Un plan inactivo no se ofrece para nuevas membresías, pero el historial lo sigue mostrando.
- **Cambiar el precio no cambia el pasado.** Cada membresía guarda su `precio_acordado` al contratarse. Si "Mensual" sube de $500 a $550, quien ya pagó $500 sigue con $500. Lo mismo aplica a la duración.
- **El nombre es único dentro del gimnasio** (sin distinguir mayúsculas ni espacios de más). Dos gimnasios sí pueden tener cada uno su plan "Mensual".
- **Límites**, iguales a los `CHECK` de la BD:
  - `nombre`: de 1 a 60 caracteres, después de quitar espacios al inicio y al final.
  - `precio`: mayor que 0, con máximo 2 decimales y hasta `99,999,999.99` (`numeric(10,2)`).
  - `duracionMeses`: entero de 1 a 24.

## El dinero viaja como texto

`precio` se envía y se recibe como **string**: `"499.00"`, no `499`.

**¿Por qué?** JavaScript guarda los números como *float*, que no puede representar exactamente muchos decimales: `0.1 + 0.2` da `0.30000000000000004`. En dinero, un centavo perdido es un bug. Como texto, el valor viaja intacto de la BD (`numeric`) al frontend, y solo se convierte a número para mostrarlo o calcular con una librería adecuada. Así lo hacen las APIs de pagos, como Stripe.

## Contrato

Todas las rutas usan `requireAuth`. Todas filtran por el `gimnasioId` de `req.auth`, **nunca** por uno que venga en la petición.

### Forma de un plan en las respuestas

```json
{
  "id": "2b7d…",
  "nombre": "Mensual",
  "precio": "500.00",
  "duracionMeses": 1,
  "activo": true
}
```

### `GET /planes`

- **Roles:** todos.
- **Query opcional:** `?incluirInactivos=true`. Sin él, solo devuelve los activos, que es lo que necesita recepción al inscribir.
- **Orden:** por `duracionMeses` y luego por `nombre`.
- **`200`:** `{ "data": [ <plan>, … ] }`. Sin paginación: un gimnasio tiene pocos planes.

> **¿Por qué `{ "data": [...] }` y no el arreglo directo?** Así, el día que haga falta paginar, se agrega `"meta": { … }` sin romper a los clientes que ya usan `data`.

### `GET /planes/:id`

- **Roles:** todos.
- **`200`:** `<plan>`, aunque esté inactivo (el historial lo necesita).
- **`404`:** no existe, es de **otro gimnasio** o el `:id` no es un UUID.

### `POST /planes`

- **Roles:** `ADMIN`, `DUENO`.
- **Body:**
  ```json
  { "nombre": "Mensual", "precio": "500.00", "duracionMeses": 1 }
  ```
  El plan siempre nace activo.
- **`201 Created`:** `<plan>`, con la cabecera `Location: /planes/<id>`.
- **`400`:** datos inválidos (ver el formato de errores).
- **`409 Conflict`:** ya existe un plan con ese nombre en el gimnasio.

### `PATCH /planes/:id`

- **Roles:** `ADMIN`, `DUENO`.
- **Body:** cualquier combinación de `nombre`, `precio`, `duracionMeses` y `activo`, con al menos uno.
  ```json
  { "precio": "550.00" }
  ```
- **`200`:** `<plan>` actualizado.
- **`400`:** body vacío o con datos inválidos.
- **`404`:** igual que en `GET /planes/:id`.
- **`409`:** el nuevo nombre ya lo usa otro plan del gimnasio.

**¿Por qué `PATCH` y no `PUT`?** `PUT` reemplaza el recurso completo: tendrías que mandar todos los campos aunque solo cambies el precio. `PATCH` cambia solo lo que envías.

### No hay `DELETE`

Desactivar es `PATCH { "activo": false }`. Un `DELETE /planes/:id` responde `404`, como cualquier ruta que no existe.

## Formato de errores (para toda la API)

Hasta ahora todos los errores eran `{ "error": "…" }`. Se mantiene, y se agrega **`detalles`** solo en los `400` de validación, para que el frontend marque cada campo del formulario:

```json
{
  "error": "Bad Request",
  "detalles": [
    { "campo": "precio", "mensaje": "Debe ser mayor que 0" },
    { "campo": "duracionMeses", "mensaje": "Debe estar entre 1 y 24" }
  ]
}
```

- Los mensajes van **en español** y están pensados para mostrarse al usuario.
- El `409` lleva un mensaje explicativo, porque no revela nada sensible: `{ "error": "Conflict", "mensaje": "Ya existe un plan llamado \"Mensual\"" }`.

## Reglas de seguridad

- ✅ **Campos desconocidos → `400`.** Si el body trae `gimnasioId`, `id` o cualquier campo que no esté en el contrato, se rechaza. Esto evita la *asignación masiva* (*mass assignment*): que alguien mande `{ "gimnasioId": "<otro gimnasio>" }` y mueva un plan a otro tenant.
- ✅ **Otro gimnasio = `404`, no `403`.** Si respondiéramos `403`, confirmaríamos que ese `id` existe en algún lado. Con `404`, para el usuario los planes de otros gimnasios simplemente no existen.
- ✅ **Cada repositorio recibe el `gimnasioId` como parámetro obligatorio** y lo pone en el `WHERE` de todas sus consultas, incluidos `update` y las comprobaciones de nombre único.
- ✅ Los `CHECK` y el `UNIQUE` de la BD siguen como última barrera. Si la API dejara pasar algo, la BD lo rechaza.

## Bitácora de auditoría

`POST` y `PATCH` escriben en `bitacora_auditoria` **en la misma transacción** que el cambio: si falla una, no se guarda ninguna. Una bitácora que a veces no registra no sirve como prueba.

| Campo | `POST` | `PATCH` |
|---|---|---|
| `accion` | `CREAR` | `ACTUALIZAR` |
| `entidad` / `entidad_id` | `planes` / id del plan | `planes` / id del plan |
| `actor_id` | `req.auth.userId` | `req.auth.userId` |
| `datos_antes` | `null` | Solo los campos que cambiaron, con su valor anterior |
| `datos_despues` | El plan completo | Solo los campos que cambiaron, con su valor nuevo |

Si un `PATCH` no cambia nada (por ejemplo, manda el mismo precio que ya tenía), responde `200` y **no** escribe en la bitácora.

## Casos de prueba

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `GET /planes` como `RECEPCION` | `200`, solo planes activos de **su** gimnasio, ordenados |
| 2 | `GET /planes?incluirInactivos=true` | `200`, también los inactivos |
| 3 | `GET /planes` nunca incluye planes de otro gimnasio | Solo planes del gimnasio del token |
| 4 | `GET /planes/:id` de un plan inactivo propio | `200` |
| 5 | `GET /planes/:id` de un plan de **otro** gimnasio | `404` |
| 6 | `GET /planes/no-es-uuid` | `404` |
| 7 | `POST /planes` como `DUENO` con datos válidos | `201`, `Location` correcto, `activo: true`, y una fila `CREAR` en la bitácora |
| 8 | `POST /planes` como `RECEPCION` | `403` |
| 9 | `POST /planes` con `precio: "0"`, `"-5"`, `"10.999"`, `"abc"` o `500` (número) | `400` con `detalles` en `precio` |
| 10 | `POST /planes` con `duracionMeses` `0`, `25` o `1.5` | `400` con `detalles` en `duracionMeses` |
| 11 | `POST /planes` con `nombre` vacío, solo espacios o de 61 caracteres | `400` con `detalles` en `nombre` |
| 12 | `POST /planes` con varios errores a la vez | `400` con **todos** los errores en `detalles` |
| 13 | `POST /planes` con un campo extra (`gimnasioId`) | `400`, y no se crea nada |
| 14 | `POST /planes` con un nombre que ya existe (`" mensual "` vs `"Mensual"`) | `409` |
| 15 | `POST /planes` con un nombre que existe solo en **otro** gimnasio | `201` |
| 16 | `PATCH /planes/:id` cambiando solo `precio` | `200`, y la bitácora guarda solo `precio` antes y después |
| 17 | `PATCH /planes/:id` con `{ "activo": false }` | `200`; deja de salir en `GET /planes` sin `incluirInactivos` |
| 18 | `PATCH /planes/:id` con body vacío `{}` | `400` |
| 19 | `PATCH /planes/:id` con los mismos valores que ya tenía | `200`, sin fila nueva en la bitácora |
| 20 | `PATCH /planes/:id` de un plan de otro gimnasio | `404`, y el plan **no** cambia |
| 21 | `PATCH /planes/:id` como `RECEPCION` | `403` |
| 22 | `PATCH` con un nombre que ya usa otro plan | `409` |
| 23 | `DELETE /planes/:id` | `404` |
| 24 | Cualquier ruta de `/planes` sin token | `401` |
| 25 | Si falla la escritura en la bitácora, el plan no se crea ni se cambia | El plan queda como estaba (rollback) |

> **Casos 3, 5, 20 y 25 contra la BD real:** `api/tests/planes.test.ts` usa un repositorio falso en memoria, que no ejercita las consultas de Prisma. Por eso [`api/tests/integration/plan.repository.test.ts`](../../api/tests/integration/plan.repository.test.ts) prueba el repositorio real contra un Postgres de prueba (`npm run test:integration`, también en la CI): el aislamiento por gimnasio en `listar`, `buscarPorId`, `existeNombre` y `actualizar` (casos 3, 5 y 20), el índice único sobre `lower(nombre)` aunque se salte el servicio (casos 14, 15 y 22), la bitácora (`CREAR` del caso 7, y `ACTUALIZAR` solo con los campos cambiados del caso 16) y el rollback del caso 25, provocando a propósito un fallo en el `INSERT` de la bitácora.

## Preguntas abiertas (decidir al aprobar)

1. **¿`precio` solo como texto, o aceptar también número (`500`)?** Propuesta: **solo texto**. Aceptar números invita a mandar `0.1 + 0.2` sin darse cuenta. El frontend formatea el input como texto de todos modos.
2. **¿Cómo probamos el repositorio real?** Los tests de esta spec usan un repositorio falso en memoria, como hasta ahora. Pero la regla más importante, filtrar por `gimnasioId`, vive en las consultas de Prisma, que ese fake no ejercita. Propuesta: en esta spec, **fakes + prueba manual** contra Supabase, y en un PR aparte (`chore`) agregar **tests de integración** contra un Postgres de prueba (por ejemplo con Docker), que servirán a todos los recursos siguientes.

3. **¿Reforzar en la BD el nombre único sin importar mayúsculas?** Hoy el `UNIQUE(gimnasio_id, nombre)` distingue mayúsculas: para la BD, `"Mensual"` y `"mensual"` son distintos. La API puede comprobarlo antes de guardar, pero si dos peticiones llegan al mismo tiempo, ambas pasarían la comprobación. Propuesta: una migración que reemplace ese `UNIQUE` por un índice único sobre `(gimnasio_id, lower(nombre))`. Así la BD es la última barrera, como con los `CHECK`, y la API traduce su error a `409`. También hay que actualizar `docs/modelo-datos.md`.

## Fuera del alcance

- **Planes con días o semanas** (por ejemplo, un pase de 1 día): el modelo solo maneja meses.
- **Precios con promociones o descuentos:** el precio especial se define al cobrar la membresía (`precio_acordado`).
- **Historial de precios en una tabla propia:** la bitácora ya guarda cada cambio con su fecha y autor.
- **Control de edición simultánea** (dos personas editan el mismo plan a la vez): gana el último. Es aceptable con 2 o 3 usuarios por gimnasio.

## En una entrevista

"El primer CRUD fijó los patrones de la API: validación con Zod y un formato de errores por campo, rechazo de campos desconocidos para evitar asignación masiva, `404` en vez de `403` para no revelar recursos de otros tenants, y bitácora de auditoría en la misma transacción que el cambio. El dinero viaja como string decimal para no perder centavos con floats, y los planes no se borran sino que se desactivan, porque el historial de membresías depende de ellos."
