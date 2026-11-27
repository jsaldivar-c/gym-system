# 0007. Anulación de pagos

- **Estado:** Implementada
- **Fecha:** 2026-11-26
- **Relacionado:** [Spec 0005](0005-api-membresias.md), [Spec 0006](0006-api-estado-clientes.md), [Brief: reglas de negocio](../brief.md#6-reglas-de-negocio-clave), [Modelo de datos: `pagos`](../modelo-datos.md#pagos)

## Objetivo

Corregir un cobro equivocado (duplicado, plan o cliente equivocado, cobro de prueba) **sin borrar nada**. Brief: *"Los pagos no se borran, se anulan"*, indicando el motivo.

Al anular el único pago válido de una membresía, esa membresía **deja de contar** y el semáforo del cliente cambia solo. No hay que tocar la vista: `v_estado_clientes` ya ignora las membresías sin pago `VALIDO` (spec 0005).

## Quién puede hacer qué

| Acción | `ADMIN` | `DUENO` | `RECEPCION` |
|---|:-:|:-:|:-:|
| Anular un pago | ✅ | ✅ | ❌ (403) |

Sale de la tabla de permisos del brief (*"Anular pagos y ver ingresos"*). Ver "Decisiones" sobre la frase *"solo el dueño"*.

## Contrato

### `POST /pagos/:id/anulacion`

Body:

| Campo | Tipo | Reglas |
|---|---|---|
| `motivo` | texto | Obligatorio, de 1 a 200 caracteres (sin espacios sobrantes) |

Es `strictObject`: cualquier otro campo → 400.

Respuestas:
- **200**: la **membresía** del pago, con la misma forma que en `GET /clientes/:clienteId/membresias`. El pago ya sale `ANULADO` y, si no le queda otro pago válido, la membresía sale con `cuenta: false`. Así el frontend reemplaza la tarjeta sin volver a pedir el historial.
- **400**: el motivo falta, está vacío o es demasiado largo.
- **403** `{ error: "Forbidden" }`: el rol es `RECEPCION`.
- **404** `{ error: "Not Found" }`: el pago no existe, es de otro gimnasio, es de un cliente bloqueado o el id no es UUID.
- **409** `{ error: "Conflict", mensaje: "El pago ya está anulado" }`: no se anula dos veces.

### Cambio en la forma del pago (spec 0005)

Cada pago, en el historial, en el cobro y en esta respuesta, agrega `anulacion`: `null` si es válido, o `{ anuladoEn, anuladoPor: { id, nombre }, motivo }` si se anuló. Es un campo **nuevo**, no rompe a quien ya consume la API.

¿Por qué `POST /pagos/:id/anulacion` y no `DELETE /pagos/:id`? Porque **no se borra nada**: se crea una anulación (con quién, cuándo y por qué). `PATCH { estado: "ANULADO" }` tampoco encaja, porque anular no es editar un campo cualquiera: lleva su propia regla y su propio permiso.

## Reglas

- Se guardan `estado = ANULADO`, `anulado_en = now()`, `anulado_por = quien anula` y `motivo_anulacion`. El CHECK `pagos_anulacion_coherente_chk` de la BD exige los cuatro juntos.
- **Bitácora**, en la misma transacción: `accion = "ANULAR_PAGO"`, `entidad = "pagos"`, `datosAntes = { estado: "VALIDO" }` y `datosDespues = { estado: "ANULADO", motivo }`.
- **Concurrencia:** dos anulaciones simultáneas del mismo pago. El `UPDATE … WHERE estado = 'VALIDO'` es atómico: solo una lo cambia, y la otra recibe 409. No hace falta `FOR UPDATE`, porque la condición va en el mismo `UPDATE`.
- La membresía **no** se cancela ni se borra: sigue en el historial, solo que ya no cuenta. Si se cobra de nuevo, la spec 0005 sugiere la fecha como si esa membresía no existiera.

## Casos de prueba

| # | Caso | Esperado |
|---|---|---|
| 1 | `DUENO` anula con motivo | 200; el pago sale `ANULADO` y la membresía con `cuenta: false` |
| 2 | `ADMIN` anula | 200 |
| 3 | `RECEPCION` anula | 403 y el pago no cambia |
| 4 | Sin motivo, vacío o de solo espacios | 400 en `motivo` |
| 5 | Motivo de más de 200 caracteres | 400 en `motivo` |
| 6 | Campo extra (`estado`, `anuladoPor`…) | 400 |
| 7 | Pago de otro gimnasio, inexistente o id no UUID | 404 |
| 8 | Pago de un cliente bloqueado | 404 |
| 9 | Pago ya anulado | 409 |
| 10 | Después de anular, el estado del cliente | Deja de contar esa membresía (p. ej., pasa a `SIN_MEMBRESIA`) |
| 11 | Después de anular, cobrar de nuevo | La fecha sugerida ignora la membresía anulada |
| 12 | Bitácora | Una fila `ANULAR_PAGO` con quién y el motivo |
| 13 | Integración: columnas y CHECK | Se guardan `anulado_en`, `anulado_por` y `motivo_anulacion` |
| 14 | Integración: dos anulaciones simultáneas | Una gana y la otra recibe "ya anulado" |
| 15 | Integración: falla la bitácora | El pago sigue `VALIDO` (rollback) |
| 16 | Integración: aislamiento | Desde otro gimnasio → null y sin cambios |
| 17 | `motivo` en los logs | No aparece (puede traer datos personales) |

## Decisiones

- **`ADMIN` y `DUENO`.** La regla del brief dice *"solo el dueño"*, pero su tabla de permisos incluye a `ADMIN`. Se sigue la tabla: `ADMIN` es quien configura el sistema por el dueño. Si el dueño quiere exclusividad, basta con quitar `ADMIN` del `requireRole`.
- **No se puede "desanular".** Si fue un error, se cobra de nuevo (queda rastro de las dos cosas).
- **Reembolsos fuera del alcance:** anular registra que el cobro no vale. Si se devolvió dinero, eso pasa fuera del sistema (en el MVP no hay caja).
