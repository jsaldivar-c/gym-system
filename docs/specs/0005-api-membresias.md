# 0005. Membresías y cobro

- **Estado:** Implementada
- **Fecha:** 2026-11-26
- **Relacionado:** [Spec 0003](0003-api-planes.md), [Spec 0004](0004-api-clientes.md), [Brief: reglas de negocio](../brief.md#6-reglas-de-negocio-clave), [Modelo de datos: `membresias` y `pagos`](../modelo-datos.md#membresias), [Vista de estado](../modelo-datos.md#vista-de-estado-el-semáforo)

## Objetivo

Que recepción pueda **cobrar** (primera membresía) y **renovar**, y que la ficha del cliente muestre su **historial** y su **estado** (el semáforo).

Es el corazón del MVP: *"Saber quién debe y cobrarle"*. Agrega **cuatro cosas nuevas**:
1. **Dos tablas en una transacción:** la membresía (el *derecho*) y su pago (el *dinero*) se guardan juntos o ninguno.
2. **Aritmética de fechas:** cuándo termina "un mes" que empieza el 31 de enero.
3. **Un candado de fila** (`SELECT … FOR UPDATE`) para que dos cobros simultáneos no encimen periodos.
4. **La vista `v_estado_clientes`** se usa por primera vez desde la API.

## Quién puede hacer qué

| Acción | `ADMIN` | `DUENO` | `RECEPCION` |
|---|:-:|:-:|:-:|
| Cobrar y renovar | ✅ | ✅ | ✅ |
| Ver historial y estado de un cliente | ✅ | ✅ | ✅ |

Viene del [brief](../brief.md#3-usuarios): *"Altas de clientes, cobros, renovaciones, consultar estados"* es de los tres roles. **Anular** pagos es solo de `ADMIN` y `DUENO`, y llega en su propia spec.

## Reglas de negocio

- **Cobrar = crear una membresía con su pago.** El MVP no tiene abonos parciales (brief): un pago cubre el periodo completo. Por eso se crean juntos, en la misma transacción, y una membresía nunca queda "sin pagar".
- **El precio se copia del plan** a `precio_acordado` y a `monto`. Si mañana el plan sube, el historial no cambia. El cliente **no** manda el precio: si lo mandara, recepción podría cobrar 1 peso. Descuentos y cortesías quedan fuera (ver "Decisiones").
- **Solo se cobra con planes activos.** Un plan retirado (`activo = false`) sigue en las membresías viejas, pero ya no se vende.
- **¿Cuándo empieza?** Si no se manda `fechaInicio` (lo normal):
  - Si el cliente tiene una membresía **vigente** → el día siguiente a su `fechaFin`. Renovar antes de tiempo no le quita días.
  - Si **venció** o nunca tuvo → **hoy**, en la zona horaria del gimnasio. Los días vencidos no se cobran.

  Es la regla del [brief](../brief.md#6-reglas-de-negocio-clave): *"empieza al día siguiente del fin de la anterior (o hoy, si ya venció)"*.
- **Se puede mandar `fechaInicio`** para capturar membresías de la libreta o programar un inicio. Límites: desde hace un año hasta dentro de 60 días.
- **Los periodos no se enciman.** Una membresía nueva no puede compartir días con otra que **cuenta**. Si se encima → `409` con la fecha sugerida.
- **Qué membresías "cuentan":** las no canceladas que tienen al menos un pago `VALIDO`. Es la misma regla de la vista: si mañana se anula un pago, esa membresía deja de contar y su periodo queda libre.
- **El estado se lee de la vista `v_estado_clientes`**, nunca se calcula en JavaScript. Así la ficha, la lista (próxima spec), el dashboard y el email diario usan **una sola regla**.

## ¿Cuándo termina "un mes"?

`fechaFin` es el **último día incluido**. Se suma la duración del plan en meses y se resta un día:

| Inicio | Plan | Fin | Por qué |
|---|---|---|---|
| `2026-11-26` | 1 mes | `2026-12-25` | El 26 de diciembre ya empieza el siguiente mes |
| `2026-12-01` | 1 mes | `2026-12-31` | Diciembre completo |
| `2026-03-31` | 1 mes | `2026-04-30` | El 31 de abril no existe: se usa el 1 de mayo, menos un día |
| `2026-01-31` | 1 mes | `2026-02-28` | El 31 de febrero no existe: 1 de marzo, menos un día |
| `2028-01-30` | 1 mes | `2028-02-29` | 2028 es bisiesto |
| `2026-11-26` | 12 meses | `2027-11-25` | |

> **¿Por qué no usar `Date.setMonth`?** JavaScript "corrige" las fechas que no existen *pasándose*: el 31 de enero más un mes da el **3 de marzo**. El cliente recibiría días de regalo según el mes en que pagó. La regla de arriba es explícita y está probada caso por caso.

## Contrato

Todas las rutas usan `requireAuth`, filtran por el `gimnasioId` de `req.auth` y responden con `Cache-Control: no-store` (son datos de un cliente, como en la spec 0004).

### Forma de una membresía en las respuestas

```json
{
  "id": "4a7b…",
  "plan": { "id": "1f2e…", "nombre": "Mensual" },
  "fechaInicio": "2026-11-26",
  "fechaFin": "2026-12-25",
  "precioAcordado": "500.00",
  "canceladaEn": null,
  "cuenta": true,
  "pagos": [
    {
      "id": "9c3d…",
      "monto": "500.00",
      "metodo": "EFECTIVO",
      "folio": null,
      "estado": "VALIDO",
      "fechaPago": "2026-11-27T01:30:00.000Z",
      "registradoPor": { "id": "6f1c…", "nombre": "Ana López" }
    }
  ]
}
```

- El dinero viaja como **texto con dos decimales**, como el precio de los planes: `float` no representa `0.1` exacto.
- `fechaInicio` y `fechaFin` son fechas de calendario (`YYYY-MM-DD`); `fechaPago` sí tiene hora (corte de caja), por eso va completa en UTC.
- `cuenta` dice si esta membresía cuenta para el estado (no cancelada y con un pago válido). El frontend la usa para tachar las que no.
- `registradoPor` lleva el nombre para que la ficha muestre "cobró Ana" sin otra petición.

### `POST /clientes/:clienteId/membresias`

- **Roles:** todos.
- **Body:**
  ```json
  { "planId": "1f2e…", "metodo": "EFECTIVO", "folio": "A-123", "fechaInicio": "2026-11-26" }
  ```
  - `planId` (obligatorio): un plan **activo** del gimnasio.
  - `metodo` (obligatorio): `EFECTIVO`, `TARJETA` o `TRANSFERENCIA`.
  - `folio` (opcional): número de recibo o referencia de la transferencia, hasta 40 caracteres.
  - `fechaInicio` (opcional): ver "¿Cuándo empieza?".
- **`201 Created`:** `<membresía>` con su único pago.
- **`400`:** datos inválidos (formato de `detalles` de la spec 0003). El plan inexistente, de otro gimnasio o inactivo también es `400` en el campo `planId`: es un dato del body, no la dirección del recurso.
- **`404`:** el cliente no existe, es de otro gimnasio, está bloqueado o `:clienteId` no es un UUID.
- **`409 Conflict`:** `fechaInicio` se encima con una membresía que cuenta.
  ```json
  { "error": "Conflict", "mensaje": "Se encima con la membresía del 2026-11-01 al 2026-11-30", "fechaInicioSugerida": "2026-12-01" }
  ```

> **¿Por qué no hay cabecera `Location`?** Una membresía no tiene su propia dirección (`GET /membresias/:id` no existe): se consulta dentro del historial del cliente. Mandar una `Location` que da `404` sería peor que no mandarla.

### `GET /clientes/:clienteId/membresias`

- **Roles:** todos.
- **`200`:**
  ```json
  {
    "estado": { "estado": "POR_VENCER", "diasRestantes": 3, "fechaFin": "2026-11-29", "membresiaId": "4a7b…" },
    "data": [ <membresía>, … ]
  }
  ```
  - `estado.estado`: `ACTIVO`, `POR_VENCER`, `VENCIDO` o `SIN_MEMBRESIA`. Con `SIN_MEMBRESIA`, los otros tres campos van `null`.
  - `diasRestantes` es negativo si ya venció (`-5` = venció hace 5 días).
  - `data`: todas las membresías del cliente, de la más reciente a la más vieja (por `fechaInicio`). Sin paginación: un cliente que renueva cada mes durante 8 años tiene 96.
- **`404`:** igual que en `POST`.

## Concurrencia: dos cobros al mismo tiempo

Recepción da doble clic, o dos recepcionistas cobran al mismo cliente a la vez. Sin protección, las dos peticiones leen "su membresía vence el 30", las dos calculan "empieza el 1" y se guardan **dos membresías encimadas**.

**Solución:** dentro de la transacción, antes de leer las membresías, se **bloquea la fila del cliente** con `SELECT … FOR UPDATE`. La segunda petición espera a que la primera termine y entonces ya ve la membresía nueva.

> **Analogía:** es la llave del baño de una gasolinera. Solo quien tiene la llave entra; el siguiente espera afuera, y cuando entra, ve lo que dejó el anterior.

**Lo que el candado NO resuelve:** con el doble clic, la segunda petición ya no se encima, sino que crea la membresía **siguiente** (dos meses cobrados). Evitarlo de verdad requiere una *llave de idempotencia* (ver "Fuera del alcance"). Mientras tanto, el frontend desactiva el botón al cobrar, y un cobro duplicado se corrige anulando el pago (próxima spec).

## Reglas de seguridad

- ✅ **Todas las de las specs 0003 y 0004**: campos desconocidos → `400`, otro gimnasio → `404`, `gimnasioId` en cada consulta del repositorio, `no-store` y nada de datos personales en los logs.
- ✅ **El precio no viene del cliente.** Se lee del plan en el servidor (ver "Reglas de negocio").
- ✅ **`registrado_por` y `creada_por` salen del token**, nunca del body: es el control antifraude del modelo de datos.
- ✅ **El `planId` se busca con el `gimnasioId`.** Un plan de otro gimnasio responde lo mismo que uno que no existe: no revela que existe.
- ✅ **El SQL a mano va parametrizado.** El candado y la consulta a la vista usan `$queryRaw` con *tagged templates* de Prisma: los valores viajan como parámetros, nunca concatenados.
- ✅ **Los `CHECK` de la BD** (`fecha_fin >= fecha_inicio`, `monto > 0`) siguen siendo la última barrera.

## Bitácora de auditoría

Un cobro escribe **dos** filas, en la misma transacción que la membresía y el pago:

| Campo | Membresía | Pago |
|---|---|---|
| `accion` | `CREAR` | `CREAR` |
| `entidad` / `entidad_id` | `membresias` / id de la membresía | `pagos` / id del pago |
| `actor_id` | `req.auth.userId` | `req.auth.userId` |
| `datos_despues` | `clienteId`, `planId`, `fechaInicio`, `fechaFin`, `precioAcordado` | `membresiaId`, `monto`, `metodo`, `folio` |

## Casos de prueba

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `POST` como `RECEPCION`, cliente sin membresías, sin `fechaInicio` | `201`; empieza **hoy** en la zona del gimnasio; `precioAcordado` y `monto` = precio del plan; pago `VALIDO` con `registradoPor` = quien cobra |
| 2 | `POST` con una membresía vigente que vence el 30 | Empieza el **día siguiente** (el 1) |
| 3 | `POST` cuando la última venció hace 10 días | Empieza **hoy** |
| 4 | `POST` con plan de 12 meses | `fechaFin` según la tabla |
| 5 | Cada fila de la tabla "¿Cuándo termina un mes?" | `fechaFin` correcta (test de la función pura) |
| 6 | `POST` con `fechaInicio` en el pasado que no se encima | `201` con esa fecha |
| 7 | `POST` con `fechaInicio` que se encima con una membresía que cuenta | `409` con `fechaInicioSugerida` |
| 8 | `POST` con `fechaInicio` que se encima con una membresía **cancelada** o con el pago **anulado** | `201`: esas no cuentan |
| 9 | `POST` con `fechaInicio` de hace más de un año, a más de 60 días, o `"2026-02-30"` | `400` en `fechaInicio` |
| 10 | `POST` con plan inactivo, de otro gimnasio, inexistente o `planId` que no es UUID | `400` en `planId` |
| 11 | `POST` sin `planId` ni `metodo`, o con `metodo: "BITCOIN"` | `400` en cada campo |
| 12 | `POST` con un campo extra (`precioAcordado`, `monto`, `registradoPorId`) | `400`, y no se crea nada |
| 13 | `POST` a un cliente de otro gimnasio, bloqueado, o `:clienteId` que no es UUID | `404`, y no se crea nada |
| 14 | `POST` escribe en la bitácora | Dos filas `CREAR`: `membresias` y `pagos` |
| 15 | `GET` historial | `200`, ordenado de la más reciente a la más vieja, con plan, pagos y `cuenta` |
| 16 | `GET` de un cliente sin membresías | `estado: SIN_MEMBRESIA` con `null` en los demás, y `data: []` |
| 17 | `GET` de otro gimnasio, bloqueado o no UUID | `404` |
| 18 | Cualquier respuesta | `Cache-Control: no-store` |
| 19 | Sin token | `401` |
| 20 | Vista: vigente → `ACTIVO`; vence en ≤ `dias_aviso` → `POR_VENCER`; venció → `VENCIDO` con `diasRestantes` negativo | Integración, contra Postgres |
| 21 | Vista: membresía con pago anulado o cancelada no cuenta | Integración |
| 22 | Dos cobros simultáneos al mismo cliente | Periodos consecutivos, **sin encimarse** (integración) |
| 23 | Si falla la bitácora, no queda ni la membresía ni el pago | Rollback (integración) |
| 24 | El repositorio solo pasa al servicio las membresías que cuentan | Integración |

> Los casos 13, 14, 20 a 24 se prueban **contra Postgres** en `api/tests/integration/membresia.repository.test.ts`. Es la primera vez que un test ejercita la vista `v_estado_clientes` y el `FOR UPDATE`, que el repositorio falso no puede imitar.

## Decisiones

Propuestas al escribir la spec (el dueño del proyecto pidió avanzar con las sugerencias):

1. **¿El semáforo en la lista (`GET /clientes?estado=VENCIDO`) entra aquí?** No; pasa a la **spec 0006**. La spec 0004 lo había asignado a esta, pero la lista necesita unir `clientes` con la vista y Prisma solo soporta vistas como función *preview*. Merece su propia decisión. Esta spec ya entrega el estado en la ficha, que es lo que necesita el botón **Cobrar**.
2. **¿Descuentos o membresías de cortesía?** Fuera por ahora. Dejar que recepción cambie el precio abre la puerta a cobrar de menos. Si se necesita, será un permiso de `DUENO` con motivo obligatorio, como la anulación.
3. **¿Cobrar a un plan de otro gimnasio es `400` o `404`?** `400` en `planId`: el `404` se reserva para la dirección (`/clientes/:clienteId`).
4. **¿Límites de `fechaInicio`?** De hace un año a dentro de 60 días. Cubre la captura de la libreta y los inicios programados, y evita errores de dedo como `2062`.

## Fuera del alcance

- **Anular pagos** (`ADMIN` y `DUENO`, con motivo): próxima spec.
- **Semáforo en la lista y filtro por estado**: spec 0006 (decisión 1).
- **Cancelar una membresía** (`cancelada_en`) y **pausas** (fase 1b).
- **Llave de idempotencia** contra el doble clic (ver "Concurrencia").
- **Descuentos y cortesías** (decisión 2).
- **Corte de caja e ingresos del mes**: llegan con el dashboard.

## En una entrevista

- **¿Por qué separar membresía y pago si siempre se crean juntos?** Porque no siempre *vivirán* juntos: un pago se puede anular sin borrar la membresía, una pausa mueve `fecha_fin` sin tocar el dinero y, en el futuro, varios abonos pueden cubrir una membresía.
- **¿Qué es `SELECT … FOR UPDATE`?** Un candado de fila dentro de una transacción. Las demás transacciones que quieran el mismo candado esperan hasta el `COMMIT`. Evita la condición de carrera *leer-calcular-escribir*.
- **¿Por qué el estado en una vista y no en JavaScript?** Una sola fuente de verdad: si la regla viviera en la API y también en el email diario, tarde o temprano dirían cosas distintas.
