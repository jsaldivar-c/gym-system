# 0001. Health check de la API

- **Estado:** Aprobada
- **Fecha:** 2026-11-18
- **Relacionado:** [ADR 0004](../adr/0004-api-express-typescript.md), [ADR 0005](../adr/0005-autenticacion-y-seguridad.md)

## Objetivo

Saber, con una petición, si la API está viva y si puede hablar con la base de datos. Lo usan:
- Nosotros en desarrollo, para comprobar que el servidor arrancó y que `DATABASE_URL` funciona.
- La plataforma de hosting (más adelante), para reiniciar el proceso si se cuelga o para no mandarle tráfico si la BD no responde.

Es el primer endpoint porque es el más simple que recorre **todas las capas** (ruta → controlador → servicio → repositorio → Prisma → Supabase). Así probamos la arquitectura completa sin reglas de negocio de por medio.

## Dos endpoints: *liveness* y *readiness*

| Endpoint | Pregunta que responde | ¿Consulta la BD? |
|---|---|:-:|
| `GET /health` | ¿El proceso está vivo y responde? (*liveness*) | ❌ |
| `GET /health/ready` | ¿Está listo para atender peticiones reales? (*readiness*) | ✅ |

**¿Por qué separarlos?** Si la BD se cae y `/health` dependiera de ella, la plataforma creería que la API está rota y la reiniciaría una y otra vez sin arreglar nada (el problema está en la BD). Con dos endpoints:
- `/health` falla → el proceso está colgado → **reiniciarlo**.
- `/health/ready` falla → el proceso está bien, pero la BD no → **esperar**, sin mandarle tráfico.

## Contrato

### `GET /health`

- **Autenticación:** ninguna (público).
- **Respuesta `200 OK`:**
  ```json
  { "status": "ok" }
  ```

### `GET /health/ready`

- **Autenticación:** ninguna (público).
- Ejecuta `SELECT 1` contra la BD, con un **timeout de 2 segundos**.
- **Respuesta `200 OK`** (la BD respondió):
  ```json
  { "status": "ok", "checks": { "database": "ok" } }
  ```
- **Respuesta `503 Service Unavailable`** (la BD falló o tardó más de 2 s):
  ```json
  { "status": "error", "checks": { "database": "error" } }
  ```

Ambas respuestas llevan `Cache-Control: no-store`, para que ningún proxy guarde un "ok" viejo.

## Reglas de seguridad

Como es público, **no revela nada útil para un atacante**:
- ❌ Sin versión de Node, Express o Prisma, ni nombre del host de la BD.
- ❌ Sin mensaje de error de Postgres ni stack trace en la respuesta. El detalle se escribe **solo en el log del servidor**.
- ❌ Sin datos del negocio: `SELECT 1` no lee ninguna tabla.
- ✅ Pasa por los mismos middlewares globales que el resto de la API (`helmet` y límite de peticiones).

## Casos de prueba

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | `GET /health` con la API arriba | `200`, `{ "status": "ok" }` |
| 2 | `GET /health/ready` con la BD disponible | `200`, `checks.database = "ok"` |
| 3 | `GET /health/ready` con la BD caída o una URL inválida | `503`, `checks.database = "error"`, sin detalle del error |
| 4 | `GET /health/ready` con la BD lenta (> 2 s) | `503` en ~2 s, sin quedarse colgado |
| 5 | `GET /health` con la BD caída | `200` (*liveness* no depende de la BD) |
| 6 | Cabeceras de cualquiera de los dos | Incluye `Cache-Control: no-store`; no incluye `X-Powered-By` |
| 7 | `GET /ruta-que-no-existe` | `404` en JSON, sin stack trace |

## Fuera del alcance

- Métricas (uso de memoria, tiempo de respuesta): llegarán con una herramienta de monitoreo.
- Revisar servicios externos (email en la fase 1b): se agregarán como nuevos `checks` cuando existan.

## En una entrevista

"Separé *liveness* de *readiness*: el primero dice si el proceso responde y el segundo si sus dependencias, como la base de datos, están disponibles. Así el orquestador reinicia solo cuando el problema es del proceso. Además, el endpoint es público, así que no expone versiones ni errores internos, y la consulta a la BD tiene timeout para que un health check nunca se quede colgado."
