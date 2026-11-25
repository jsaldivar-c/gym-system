# Specs (especificaciones de funciones)

Una **spec** describe **qué** debe hacer una función antes de programarla: el contrato (entradas y salidas), los casos de error y cómo se prueba.

| | ADR | Spec |
|---|---|---|
| Responde | ¿Por qué elegimos X? | ¿Qué hace exactamente esta función? |
| Alcance | Decisión de arquitectura (todo el sistema) | Una función o endpoint concreto |
| Cambia | Casi nunca (se reemplaza con otro ADR) | Mientras la función evoluciona |

## Convenciones

- Archivo: `NNNN-area-nombre.md` (por ejemplo `0001-api-health.md`).
- Estado: `Borrador` → `Aprobada` → `Implementada`.
- La spec se escribe y se revisa **antes** del código, y entra en el mismo PR que la implementación.
- Los **casos de prueba** de la spec se convierten en los tests automatizados.

## Índice

| # | Spec | Estado |
|---|---|---|
| 0001 | [Health check de la API](0001-api-health.md) | Implementada |
| 0002 | [Autenticación y perfil del staff](0002-api-autenticacion.md) | Implementada |
