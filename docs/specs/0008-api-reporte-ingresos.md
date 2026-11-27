# 0008. Reporte de ingresos

- **Estado:** Implementada
- **Fecha:** 2026-11-27
- **Relacionado:** [Spec 0005](0005-api-membresias.md), [Spec 0007](0007-api-anular-pagos.md), [Brief: usuarios](../brief.md#3-usuarios)

## Objetivo

Que el dueño sepa **cuánto entró** en un periodo, día por día y por método de pago, sin contar los pagos anulados. Es la otra mitad del permiso *"Anular pagos y ver ingresos"* del brief.

## Quién puede hacer qué

| Acción | `ADMIN` | `DUENO` | `RECEPCION` |
|---|:-:|:-:|:-:|
| Ver el reporte de ingresos | ✅ | ✅ | ❌ (403) |

## Contrato

### `GET /reportes/ingresos?desde=AAAA-MM-DD&hasta=AAAA-MM-DD`

| Parámetro | Reglas | Por defecto |
|---|---|---|
| `desde` | Fecha real `AAAA-MM-DD` | El día 1 del mes de `hasta` |
| `hasta` | Fecha real `AAAA-MM-DD`, igual o posterior a `desde` | Hoy (en la zona del gimnasio) |

- Los dos extremos **se incluyen**. Las fechas son días **del gimnasio**: un pago del 26 a las 11 p. m. en Ciudad de México es del 26, aunque en UTC ya sea 27.
- El rango puede ser de **366 días como máximo** (un año, aunque sea bisiesto). Si es mayor → 400 en `hasta`.
- `hasta` anterior a `desde` → 400 en `hasta` con *"Debe ser igual o posterior a desde"*.

Respuesta **200**:

```json
{
  "desde": "2026-11-01",
  "hasta": "2026-11-27",
  "total": "15500.00",
  "pagos": 31,
  "porMetodo": [
    { "metodo": "EFECTIVO", "total": "9000.00", "pagos": 18 },
    { "metodo": "TARJETA", "total": "5000.00", "pagos": 10 },
    { "metodo": "TRANSFERENCIA", "total": "1500.00", "pagos": 3 }
  ],
  "porDia": [
    { "fecha": "2026-11-01", "total": "1000.00", "pagos": 2 }
  ],
  "anulados": { "total": "500.00", "pagos": 1 }
}
```

- `total`, `pagos`, `porMetodo` y `porDia` cuentan **solo pagos `VALIDO`**.
- `porMetodo` trae **siempre los tres métodos**, en ese orden, aunque alguno esté en `"0.00"`. Así el frontend no tiene que adivinar cuáles faltan.
- `porDia` trae **solo los días con pagos válidos**, en orden ascendente. Rellenar los días vacíos es cosa de la gráfica.
- `anulados` informa cuánto se anuló en el periodo (por *fecha del pago*, no de la anulación): sirve para detectar anulaciones raras.
- El dinero viaja como **texto con 2 decimales**, igual que en las specs anteriores.

## Reglas

- **Los pagos cuentan por la fecha en que se cobraron** (`fecha_pago`), no por el periodo de la membresía. Un anual de $5,000 cobrado en noviembre suma $5,000 a noviembre: es un reporte de *caja*, no contable.
- **Cuentan los pagos de clientes bloqueados.** El dinero entró igual. El reporte no muestra datos de clientes, solo sumas.
- **Sumas sin `float`.** La BD suma (`sum(monto)` sobre `numeric`) y la API junta los resultados en **centavos enteros** (`BigInt`). `0.1 + 0.2` en JavaScript da `0.30000000000000004`; con centavos, nunca.

## Cómo se implementa

- **Una consulta** agrupada por día, método y estado, con `$queryRaw` parametrizado. El día se calcula con `fecha_pago AT TIME ZONE <zona del gimnasio>`.
- El filtro del rango compara `fecha_pago` contra los **instantes** de inicio y fin del rango en la zona del gimnasio. Así puede usar el índice `(gimnasio_id, fecha_pago)` en vez de convertir cada fila.
- El servicio arma `total`, `porMetodo`, `porDia` y `anulados` a partir de esas filas (una función pura, fácil de probar).

## Casos de prueba

| # | Caso | Esperado |
|---|---|---|
| 1 | `DUENO` sin parámetros | 200; del 1 del mes a hoy (zona del gimnasio) |
| 2 | `ADMIN` | 200 |
| 3 | `RECEPCION` | 403 |
| 4 | Total, pagos y desglose | Suman solo los `VALIDO` |
| 5 | Los anulados | Van aparte en `anulados` |
| 6 | `porMetodo` con un método sin pagos | Aparece en `"0.00"` y `0` |
| 7 | `porDia` | Solo días con pagos, ascendente |
| 8 | Sumas con centavos (`0.10 + 0.20`) | `"0.30"` exacto |
| 9 | `hasta` < `desde` | 400 en `hasta` |
| 10 | Rango de 367 días | 400 en `hasta`; 366 sí se permite |
| 11 | Fecha inválida (`2026-02-30`, `abc`) | 400 en ese campo |
| 12 | Solo `desde` / solo `hasta` | Se completa el otro según la tabla |
| 13 | `Cache-Control` | `no-store` |
| 14 | Integración: día del gimnasio | Un pago a las 11:30 p. m. de Ciudad de México cuenta en ese día |
| 15 | Integración: extremos del rango | Incluidos; el día siguiente queda fuera |
| 16 | Integración: aislamiento | Nunca suma pagos de otro gimnasio |

## Decisiones

- **Sin agrupar por semana o mes** por ahora: con `porDia` el frontend puede agrupar. Si el rango anual pesa, se agrega `?agrupar=mes`.
- **Sin desglose por plan o por recepcionista.** Llega cuando el dueño lo pida (el dato ya existe: `registrado_por`).
