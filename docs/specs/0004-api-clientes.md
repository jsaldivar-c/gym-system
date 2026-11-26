# 0004. Clientes del gimnasio

- **Estado:** Implementada
- **Fecha:** 2026-11-26
- **Relacionado:** [Spec 0003](0003-api-planes.md), [Brief: usuarios y pantallas](../brief.md#3-usuarios), [Modelo de datos: `clientes`](../modelo-datos.md#clientes), [Privacidad desde el diseño](../modelo-datos.md#privacidad-desde-el-diseño)

## Objetivo

Dar de alta, buscar, consultar y editar a los **clientes** del gimnasio. Es la base de la pantalla "Lista de clientes", de la ficha y del "alta rápida", y lo necesitan las membresías: no se le puede cobrar a alguien que no existe.

Reusa los tres patrones de la [spec 0003](0003-api-planes.md) (validación con Zod, aislamiento por gimnasio y bitácora en la misma transacción) y agrega **cuatro cosas nuevas**:
1. **Datos personales** (nombre, teléfono, email): respuestas sin caché y cuidado con lo que se registra en los logs.
2. **Normalización del teléfono**: el usuario escribe `(55) 1234-5678`, la BD guarda `5512345678`.
3. **Búsqueda y paginación** en la lista, porque un gimnasio tiene cientos de clientes y no 3 planes.
4. **Fechas sin hora** (`date`) y la zona horaria del gimnasio.

## Quién puede hacer qué

| Acción | `ADMIN` | `DUENO` | `RECEPCION` |
|---|:-:|:-:|:-:|
| Buscar y ver clientes | ✅ | ✅ | ✅ |
| Dar de alta clientes | ✅ | ✅ | ✅ |
| Editar datos de contacto, emergencia y notas | ✅ | ✅ | ✅ |

Viene del [brief](../brief.md#3-usuarios): *"Altas de clientes, cobros, renovaciones, consultar estados"* es de los tres roles. Recepción es quien inscribe en el mostrador.

## Reglas de negocio

- **Un cliente no se borra.** Tiene membresías y pagos que la contabilidad necesita. El ciclo de vida de sus datos (`ACTIVO → BLOQUEADO → SUPRIMIDO`, por la LFPDPPP) es una función aparte (ver "Fuera del alcance").
- **El teléfono es único dentro del gimnasio.** Es el identificador práctico en México (WhatsApp). La misma persona sí puede estar inscrita en dos gimnasios distintos.
- **El teléfono se guarda normalizado a 10 dígitos.** Se aceptan los formatos comunes y se limpian:

  | El usuario escribe | Se guarda |
  |---|---|
  | `5512345678` | `5512345678` |
  | `55 1234 5678`, `55-1234-5678`, `(55) 1234-5678` | `5512345678` |
  | `+52 55 1234 5678`, `525512345678` | `5512345678` (se quita la lada de México) |
  | `+521 55 1234 5678` | `5512345678` (se quita el `1` antiguo de celulares) |
  | `1234`, `+1 212 555 0100`, `55-ABCD-5678` | `400` |

  Lo mismo aplica a `contactoEmergenciaTelefono`. Así la búsqueda, el `UNIQUE` y el botón de WhatsApp funcionan igual sin importar cómo se capturó.
- **El email se guarda en minúsculas y sin espacios**, porque `Ana@Mail.com` y `ana@mail.com` son el mismo buzón. Es opcional y **no** es único: una mamá y su hijo pueden compartir el correo.
- **Se guarda la fecha de nacimiento, no la edad**, porque la edad cambia sola cada año.
- **`fechaInscripcion` es "hoy" en la zona horaria del gimnasio.** Si el servidor usara su propia fecha (UTC), un cliente inscrito a las 7 p. m. en la Ciudad de México quedaría con fecha de mañana. Se puede mandar una fecha pasada para capturar clientes que ya venían de la libreta.
- **`notas` no es para datos de salud** (lesiones, enfermedades). La fase 1 no tiene el consentimiento que la ley exige para eso. La API no puede detectarlo; el frontend lo advierte junto al campo.
- **Límites.** Los formatos de teléfono y email ya los exigen `CHECK` de la BD. Las longitudes máximas las pone solo la API, para que nadie guarde un "nombre" de 1 MB:
  - `nombres`, `apellidos`: de 1 a 80 caracteres, sin espacios al inicio ni al final.
  - `telefono`: 10 dígitos después de normalizar.
  - `email`: formato `algo@dominio.ext`, hasta 254 caracteres.
  - `fechaNacimiento`: `YYYY-MM-DD`, no puede ser futura ni de hace más de 120 años.
  - `fechaInscripcion`: `YYYY-MM-DD`, no puede ser futura.
  - `contactoEmergenciaNombre`, `contactoEmergenciaParentesco`: hasta 80 caracteres.
  - `notas`: hasta 500 caracteres.

## Las fechas viajan como `YYYY-MM-DD`

`fechaNacimiento` y `fechaInscripcion` son columnas `date`: **un día del calendario, sin hora ni zona horaria**. Viajan como el texto `"1990-05-14"`, no como `"1990-05-14T00:00:00.000Z"`.

**¿Por qué?** Si viajaran como fecha con hora en UTC, el navegador de alguien en México las convertiría a su hora local y `1990-05-14T00:00Z` se mostraría como **13** de mayo a las 6 p. m. Un cumpleaños no tiene hora. El texto llega intacto y el frontend lo muestra tal cual.

## Contrato

Todas las rutas usan `requireAuth`. Todas filtran por el `gimnasioId` de `req.auth`, **nunca** por uno que venga en la petición. Todas responden con `Cache-Control: no-store`, porque llevan datos personales (ver "Reglas de seguridad").

### Forma de un cliente en las respuestas

```json
{
  "id": "7c1e…",
  "nombres": "Ana",
  "apellidos": "López García",
  "telefono": "5512345678",
  "email": "ana@mail.com",
  "fechaNacimiento": "1990-05-14",
  "fechaInscripcion": "2026-11-26",
  "contactoEmergencia": {
    "nombre": "Luis López",
    "telefono": "5587654321",
    "parentesco": "Hermano"
  },
  "notas": "Prefiere que le escriban por la tarde"
}
```

- Los campos opcionales vacíos van como `null`; no se omiten. Así el frontend siempre recibe la misma forma.
- `contactoEmergencia` se agrupa en un objeto porque son tres datos de lo mismo. Si los tres están vacíos, va `null`.
- **No** se exponen `estadoRegistro`, `bloqueadoEn` ni `suprimirEn`: son del ciclo de vida de los datos y llegan con su propia spec.

### `GET /clientes`

- **Roles:** todos.
- **Query opcional:**
  - `buscar`: texto libre. Si trae dígitos, busca en el teléfono (`"1234"` encuentra `5512345678`). Si trae letras, busca cada palabra en `nombres` o `apellidos` sin distinguir mayúsculas: `"ana lop"` encuentra a "Ana López García".
  - `pagina`: desde `1` (por defecto `1`).
  - `porPagina`: de `1` a `100` (por defecto `20`).
- **Orden:** por `apellidos`, luego `nombres` y luego `id`, para que el orden sea estable entre páginas.
- **Solo** clientes con `estado_registro = ACTIVO`.
- **`200`:**
  ```json
  {
    "data": [ <cliente>, … ],
    "meta": { "pagina": 1, "porPagina": 20, "total": 137 }
  }
  ```
  Aquí se cumple lo que anticipó la spec 0003: el `meta` se agrega junto a `data` sin romper nada.
- **`400`:** `pagina` o `porPagina` inválidos (`0`, `-1`, `abc`, `porPagina=500`), o `buscar` de más de 100 caracteres.

> **¿Por qué paginación por número de página (*offset*) y no por cursor?** El cursor es mejor con millones de filas o con datos que cambian cada segundo. Un gimnasio tiene cientos de clientes, y la pantalla necesita "página 3 de 7". El offset es más simple y suficiente.

### `GET /clientes/:id`

- **Roles:** todos.
- **`200`:** `<cliente>`.
- **`404`:** no existe, es de **otro gimnasio**, está bloqueado o el `:id` no es un UUID.

### `POST /clientes`

- **Roles:** todos.
- **Body** (solo `nombres`, `apellidos` y `telefono` son obligatorios):
  ```json
  {
    "nombres": "Ana",
    "apellidos": "López García",
    "telefono": "(55) 1234-5678",
    "email": "Ana@Mail.com",
    "fechaNacimiento": "1990-05-14",
    "fechaInscripcion": "2026-11-20",
    "contactoEmergencia": { "nombre": "Luis López", "telefono": "55 8765 4321", "parentesco": "Hermano" },
    "notas": "Prefiere que le escriban por la tarde"
  }
  ```
- **`201 Created`:** `<cliente>` ya normalizado, con la cabecera `Location: /clientes/<id>`.
- **`400`:** datos inválidos, con el mismo formato de `detalles` de la spec 0003. Los errores dentro de `contactoEmergencia` usan la ruta con punto: `{ "campo": "contactoEmergencia.telefono", … }`.
- **`409 Conflict`:** ya hay un cliente con ese teléfono en el gimnasio.
  ```json
  { "error": "Conflict", "mensaje": "Ya existe un cliente con el teléfono 5512345678", "clienteId": "7c1e…" }
  ```
  El `clienteId` permite que recepción abra la ficha existente en vez de crear un duplicado. No revela nada nuevo: es un cliente del mismo gimnasio, que ese usuario ya puede ver.

### `PATCH /clientes/:id`

- **Roles:** todos.
- **Body:** cualquier combinación de los campos de `POST`, con al menos uno.
  - Para **borrar** un campo opcional se manda `null`: `{ "email": null }`.
  - Omitir un campo significa **no cambiarlo**. Esa es la diferencia entre `undefined` (no viene) y `null` (viene vacío).
  - `nombres`, `apellidos`, `telefono` y `fechaInscripcion` no aceptan `null`: son obligatorios.
  - `contactoEmergencia` se reemplaza completo: `{ "contactoEmergencia": { "nombre": "Luis", "telefono": "5587654321", "parentesco": null } }`. Con `null`, se borran los tres.
- **`200`:** `<cliente>` actualizado.
- **`400`:** body vacío o con datos inválidos.
- **`404`:** igual que en `GET /clientes/:id`.
- **`409`:** el nuevo teléfono ya lo usa otro cliente del gimnasio.

### No hay `DELETE`

`DELETE /clientes/:id` responde `404`, como cualquier ruta que no existe.

## Reglas de seguridad

- ✅ **Todas las de la spec 0003**: campos desconocidos → `400` (sin asignación masiva), otro gimnasio → `404`, `gimnasioId` obligatorio en cada consulta del repositorio, `CHECK` y `UNIQUE` de la BD como última barrera.
- ✅ **`Cache-Control: no-store`** en todas las respuestas. Sin esto, un navegador o un proxy podría guardar la lista de clientes en disco, y la vería el siguiente que use esa computadora de recepción.
- ✅ **Los datos personales no van a los logs.** Si algo falla, el log registra el `id` del cliente, no su nombre, teléfono ni email. Tampoco se registra el texto de `buscar`, que suele ser un nombre o un teléfono. Los logs se guardan más tiempo y los ve más gente que la BD.
- ✅ **El texto de `buscar` nunca se concatena en SQL.** Se pasa como parámetro a Prisma, así que no hay *inyección SQL*. Pero Prisma traduce `contains` a `LIKE '%texto%'` **sin escapar** los comodines `%` y `_`: el repositorio los escapa antes, para que se busquen como texto normal.
- ✅ **Los errores de Prisma no se copian al log.** Su mensaje puede incluir los datos de la consulta (nombre, teléfono…). Ante un `500`, el log registra solo el tipo y el código del error.
- ✅ **Paginación con tope** (`porPagina` ≤ 100), para que nadie descargue todos los clientes en una sola petición.

## Bitácora de auditoría

Igual que en la spec 0003, en la misma transacción que el cambio:

| Campo | `POST` | `PATCH` |
|---|---|---|
| `accion` | `CREAR` | `ACTUALIZAR` |
| `entidad` / `entidad_id` | `clientes` / id del cliente | `clientes` / id del cliente |
| `actor_id` | `req.auth.userId` | `req.auth.userId` |
| `datos_antes` | `null` | Solo los campos que cambiaron, con su valor anterior |
| `datos_despues` | El cliente completo, ya normalizado | Solo los campos que cambiaron, con su valor nuevo |

La comparación es con los valores **normalizados**: cambiar `5512345678` por `(55) 1234-5678` no es un cambio, responde `200` y no escribe en la bitácora.

> La bitácora sí guarda datos personales, porque su trabajo es demostrar qué cambió. Cuando llegue la supresión (LFPDPPP), esos registros también deberán anonimizarse. Queda anotado para esa spec.

## Casos de prueba

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `GET /clientes` como `RECEPCION` | `200`, clientes de **su** gimnasio ordenados por apellidos, con `meta` |
| 2 | `GET /clientes` nunca incluye clientes de otro gimnasio | Ni en `data` ni en `meta.total` |
| 3 | `GET /clientes?buscar=lop` | Encuentra "López", sin distinguir mayúsculas |
| 4 | `GET /clientes?buscar=ana lop` | Encuentra a "Ana López"; no a "Ana Ruiz" ni a "Luis López" |
| 5 | `GET /clientes?buscar=1234` | Encuentra por parte del teléfono |
| 6 | `GET /clientes?buscar=%` | Busca el carácter `%` literal: `200` sin resultados, no "todos" |
| 7 | `GET /clientes?pagina=2&porPagina=2` | La segunda página, y `meta.total` es el total sin paginar |
| 8 | `GET /clientes?porPagina=500`, `pagina=0` o `pagina=abc` | `400` con `detalles` en el campo correspondiente |
| 9 | `GET /clientes` no incluye clientes `BLOQUEADO` | Tampoco cuentan en `meta.total` |
| 10 | `GET /clientes/:id` de un cliente propio | `200`, con fechas `YYYY-MM-DD` y opcionales en `null` |
| 11 | `GET /clientes/:id` de **otro** gimnasio, bloqueado, o que no es UUID | `404` |
| 12 | Cualquier respuesta de `/clientes` | Lleva `Cache-Control: no-store` |
| 13 | `POST /clientes` como `RECEPCION` con solo los obligatorios | `201`, `Location` correcto, `fechaInscripcion` = hoy **en la zona del gimnasio**, y una fila `CREAR` en la bitácora |
| 14 | `POST /clientes` con todos los campos y formatos "sucios" | `201`, teléfonos a 10 dígitos, email en minúsculas, nombres sin espacios extra |
| 15 | `POST` con cada teléfono de la tabla de normalización | Se guarda lo que dice la tabla, o `400` en `telefono` |
| 16 | `POST` con email inválido, fecha futura, fecha `"2026-02-30"` o nombre de 81 caracteres | `400` en el campo correspondiente |
| 17 | `POST` con `contactoEmergencia.telefono` inválido | `400` en `contactoEmergencia.telefono` |
| 18 | `POST` con un campo extra (`gimnasioId`, `estadoRegistro`) | `400`, y no se crea nada |
| 19 | `POST` con un teléfono que ya existe, escrito en otro formato | `409` con el `clienteId` del existente |
| 20 | `POST` con un teléfono que existe solo en **otro** gimnasio | `201` |
| 21 | `PATCH /clientes/:id` cambiando solo `email` | `200`, y la bitácora guarda solo `email` antes y después |
| 22 | `PATCH` con `{ "email": null }` | `200`, `email` queda en `null` |
| 23 | `PATCH` con `{ "telefono": null }` | `400` en `telefono` |
| 24 | `PATCH` con el mismo teléfono en otro formato | `200`, sin fila nueva en la bitácora |
| 25 | `PATCH` con body vacío `{}` | `400` |
| 26 | `PATCH` de un cliente de otro gimnasio | `404`, y el cliente **no** cambia |
| 27 | `PATCH` con un teléfono que ya usa otro cliente | `409` |
| 28 | `DELETE /clientes/:id` | `404` |
| 29 | Cualquier ruta de `/clientes` sin token | `401` |
| 30 | Si falla la escritura en la bitácora, el cliente no se crea ni se cambia | Rollback (test de integración) |
| 31 | Ningún log contiene el nombre, teléfono, email ni el texto de `buscar` | Se revisan las llamadas al logger falso |

> Los casos 2, 3 a 6, 9, 11, 19, 20, 26 y 30 también se prueban **contra Postgres** en `api/tests/integration/cliente.repository.test.ts`, como se hizo con los planes: el filtro por gimnasio, la búsqueda real con `ILIKE` y el `UNIQUE(gimnasio_id, telefono)` viven en las consultas, y el repositorio falso no los ejercita.

## Decisiones al aprobar

Se aprobaron las cuatro propuestas:

1. ✅ **¿Incluir el estado (semáforo) en la lista ya?** No. La vista `v_estado_clientes` existe, pero sin membresías todos saldrían `SIN_MEMBRESIA`, y no habría cómo probar los otros estados. Propuesta: **dejarlo para la spec de membresías**, que agregará `estado` y `diasRestantes` a la respuesta y el filtro `?estado=VENCIDO`. Agregar campos a una respuesta no rompe a nadie.
2. ✅ **¿Registrar el aviso de privacidad en el alta?** En su propia spec. La LFPDPPP pide poder demostrar que el cliente recibió el aviso, y la tabla `consentimientos` ya existe. Pero falta definir el texto del aviso y su versión, que debe revisar un abogado. Propuesta: **spec propia** (consentimientos y ciclo de vida de datos) antes de usar el sistema con clientes reales, y en esta spec no se toca esa tabla.
3. ✅ **¿La búsqueda ignora acentos?** No, por ahora (lo documenta el caso 3b de los tests). Hoy `"lopez"` **no** encontraría "López". Arreglarlo requiere la extensión `unaccent` de Postgres y un índice especial. Propuesta: **dejarlo fuera** por ahora. Recepción casi siempre busca por teléfono, y es una mejora que no cambia el contrato.
4. ✅ **¿De dónde sale la zona horaria del gimnasio?** De `req.auth.zonaHoraria`. El `fechaInscripcion` por defecto necesita `gimnasios.zona_horaria`. Propuesta: agregarla a `req.auth` (se carga junto con el perfil, en la misma consulta que ya se hace en cada petición) para no consultar la BD otra vez.

## Fuera del alcance

- **Bloquear y suprimir datos** (`estadoRegistro`, `bloqueadoEn`, `suprimirEn`) y **consentimientos**: spec propia, con reglas legales (pregunta 2).
- **Estado del semáforo** y filtro por estado: el estado en la ficha llegó con la [spec 0005](0005-api-membresias.md); la lista y el filtro pasan a la spec 0006.
- **Fusionar clientes duplicados** (alguien registrado dos veces con distinto teléfono).
- **Foto del cliente** y **datos de salud** (fase 4).
- **Exportar la lista** (CSV o Excel): según el brief, es una función del `ADMIN` con su propia spec.
- **Control de edición simultánea:** gana el último, como en los planes.

## En una entrevista

"Los clientes agregaron datos personales a la API. Normalizo el teléfono a 10 dígitos antes de validar su unicidad, para que `(55) 1234-5678` y `+52 5512345678` no creen duplicados. Las respuestas llevan `Cache-Control: no-store` y los logs nunca registran nombres, teléfonos ni búsquedas. La lista tiene búsqueda parametrizada y paginación con tope. Las fechas sin hora viajan como `YYYY-MM-DD` para que la zona horaria del navegador no mueva un cumpleaños, y 'hoy' se calcula en la zona del gimnasio, no en la del servidor."
