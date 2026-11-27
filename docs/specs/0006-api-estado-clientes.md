# 0006. Estado en la lista de clientes (el semáforo)

- **Estado:** Implementada
- **Fecha:** 2026-11-26
- **Relacionado:** [Spec 0004](0004-api-clientes.md), [Spec 0005](0005-api-membresias.md), [Vista de estado](../modelo-datos.md#vista-de-estado-el-semáforo)

## Objetivo

Que recepción vea **de un vistazo, en la lista**, quién está al día y quién debe, y que pueda **filtrar** por eso: *"muéstrame los vencidos para llamarles"*.

La spec 0005 ya calcula el estado para **un** cliente (`GET /clientes/:id/membresias`). Esta spec lo lleva a:
1. `GET /clientes`: cada cliente trae su `estado`, y se puede filtrar con `?estado=`.
2. `GET /clientes/:id`: la ficha también trae su `estado`.

No se agrega ninguna tabla ni migración: todo sale de la vista `v_estado_clientes`, que sigue siendo **la única fuente de la regla** del semáforo.

## Quién puede hacer qué

Igual que la spec 0004: los tres roles (`ADMIN`, `DUENO`, `RECEPCION`) ven la lista y la ficha.

## Contrato

### `GET /clientes`

Query nueva (las de la spec 0004 siguen igual: `buscar`, `pagina`, `porPagina`):

| Parámetro | Valores | Por defecto |
|---|---|---|
| `estado` | `ACTIVO`, `POR_VENCER`, `VENCIDO`, `SIN_MEMBRESIA` | sin filtro |

- Se combina con `buscar` (las dos condiciones a la vez) y con la paginación. `meta.total` cuenta solo lo que pasa el filtro.
- Un valor distinto → **400** en `estado` con el mensaje *"Debe ser ACTIVO, POR_VENCER, VENCIDO o SIN_MEMBRESIA"*.
- `?estado=` vacío = sin filtro (igual que `?buscar=`).

Cada elemento de `data` agrega `estado`, con la **misma forma** que la spec 0005:

```json
{
  "id": "…",
  "nombres": "Ana",
  "apellidos": "López García",
  "...": "los demás campos de la spec 0004",
  "estado": { "estado": "POR_VENCER", "diasRestantes": 3, "fechaFin": "2026-11-29", "membresiaId": "…" }
}
```

Sin membresías que cuenten: `{ "estado": "SIN_MEMBRESIA", "diasRestantes": null, "fechaFin": null, "membresiaId": null }`.

### `GET /clientes/:id`

Agrega el mismo objeto `estado`. Los 404 no cambian.

### Lo que **no** cambia

`POST /clientes` y `PATCH /clientes/:id` siguen respondiendo el cliente **sin** `estado`: dar de alta o corregir un teléfono no toca membresías, y así esas rutas no consultan la vista. El frontend recarga la ficha si lo necesita.

## Cómo se implementa

- **Una sola consulta** por página: `clientes JOIN v_estado_clientes`, con los filtros (gimnasio, activos, búsqueda, estado), el orden (apellidos, nombres, id) y `LIMIT/OFFSET`. Más un `count(*)` con los mismos filtros, en la misma transacción.
- Se escribe con **`$queryRaw` parametrizado** (fragmentos `Prisma.sql`), porque Prisma no puede hacer `JOIN` con una vista que no está en el esquema. Se descartó declarar la vista en `schema.prisma` (función *preview* `views`): agrega una pieza en fase de pruebas solo para esto.
- La búsqueda conserva las reglas de la spec 0004: `ILIKE` por palabra en nombres o apellidos, `LIKE` en el teléfono y los comodines `%` y `_` escapados.
- `buscarPorId` (que usan `PATCH` y el cobro) **no** cambia: sigue sin estado. La ficha usa un método nuevo, `buscarConEstado`.

## Casos de prueba

| # | Caso | Esperado |
|---|---|---|
| 1 | `GET /clientes` | Cada cliente trae `estado` con sus 4 campos |
| 2 | Un cliente sin membresías | `estado: SIN_MEMBRESIA` y los demás en `null` |
| 3 | `?estado=VENCIDO` | Solo los vencidos; `meta.total` = cuántos vencidos |
| 4 | `?estado=VENCIDO&buscar=lóp` | Cumple las dos condiciones |
| 5 | `?estado=POR_VENCER&pagina=2&porPagina=1` | Pagina sobre lo filtrado |
| 6 | `?estado=vencido` (minúsculas) o `?estado=OTRO` | 400 en `estado` |
| 7 | `?estado=` | Sin filtro |
| 8 | `GET /clientes/:id` | Trae `estado` |
| 9 | `POST` y `PATCH` | Responden **sin** `estado` |
| 10 | Integración: la consulta real | El estado sale de la vista (ACTIVO, POR_VENCER, VENCIDO, SIN_MEMBRESIA) |
| 11 | Integración: filtro + búsqueda + paginación | Mismo resultado que la spec 0004 más el filtro |
| 12 | Integración: aislamiento | Nunca aparece un cliente de otro gimnasio ni un bloqueado |

## Decisiones

- **Un solo valor en `?estado=`.** "Vencidos y por vencer" juntos (para el seguimiento) puede llegar después como lista separada por comas, sin romper este contrato.
- **Sin ordenar por estado o por días restantes** por ahora: el orden sigue siendo alfabético. Se agrega cuando el dashboard lo pida.
