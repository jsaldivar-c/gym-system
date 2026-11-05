# Brief del proyecto: gym-system

> Documento vivo. Se actualiza al cerrar cada fase.
> Última actualización: 2026-10-31

## 1. Visión

Un sistema web para que el **dueño y los recepcionistas** de un gimnasio sepan en dos segundos si un cliente está al corriente, y que el dueño sepa cada mañana a quién hay que cobrarle.

Empieza con un solo gimnasio y una mensualidad fija. Está diseñado para crecer a varios gimnasios, más planes, notificaciones e historial de avance sin rehacer la base.

## 2. Problema

- Los pagos se controlan a mano (libreta, Excel o memoria). Se escapan vencimientos y nadie sabe exactamente quién debe.
- El software comercial (Mindbody, Glofox, Wodify) está pensado para cobro automático con tarjeta en EE. UU. Un gimnasio mexicano cobra en efectivo o con terminal en recepción y avisa por WhatsApp.
- Las reseñas de esos productos se quejan de "demasiados clics" y de curvas de aprendizaje largas.

Fuente: [informe de benchmark](reports/Software%20de%20gestión%20de%20gimnasios.md).

## 3. Usuarios

| Rol | Quién | Puede |
|---|---|---|
| **Dueño** (`DUENO`) | Dueño o encargado | Todo: precios y planes, staff, anular pagos, ver ingresos, exportar datos |
| **Recepción** (`RECEPCION`) | Recepcionistas | Dar de alta clientes, registrar pagos, renovar y consultar estados. **No** anula pagos ni cambia precios |

Los clientes del gimnasio **no** entran al sistema en las primeras fases.

## 4. Alcance por fases

| Fase | Contenido | Resultado para el negocio |
|---|---|---|
| **0. Fundamentos** | Documentación, ADRs, repositorio, CI y esquema de BD | Base profesional antes de escribir funciones |
| **1. MVP** | Login del staff, clientes, planes, membresías, pagos, estado derivado (semáforo), dashboard, bitácora de auditoría y botón "Enviar WhatsApp" (`wa.me`, envío manual) | Saber quién debe y cobrarle |
| **1b** | Email diario al dueño (vencidos, por vencer, pagos de ayer) y pausa de membresía | El "corte" llega solo cada mañana |
| **2** | Inventario de equipos y bitácora de mantenimiento | Control de máquinas y servicios |
| **3** | Notificaciones automáticas a clientes (WhatsApp Cloud API o email) | Menos cobranza manual |
| **4** | Entrevista inicial, objetivos, plan básico y mediciones de avance | Retención y seguimiento (incluye **datos sensibles**) |

> El informe sugería mediciones antes que inventario. Mantenemos el orden del dueño del proyecto: el inventario no involucra datos sensibles y sirve para practicar CRUD antes de enfrentar el consentimiento de salud.

### Fuera del alcance del MVP
- Cobro automático con tarjeta, links de pago y facturación CFDI.
- Reservas de clases y app para clientes.
- Abonos parciales: un pago cubre un periodo completo.
- Datos de salud (llegan en la fase 4, con su propia tabla y consentimiento).

## 5. Pantallas del MVP

1. **Dashboard:** tarjetas de activos, por vencer, vencidos e ingresos del mes. **Cada número abre su lista filtrada.**
2. **Lista de clientes:** tabla con búsqueda por nombre o teléfono, filtros por estado y badge de semáforo (verde, ámbar, rojo). En el celular se muestra como tarjetas.
3. **Ficha del cliente:** cabecera con nombre, badge, días restantes y botones **Cobrar**, **Renovar** y **WhatsApp**; pestañas Resumen, Pagos y Notas.
4. **Alta rápida en una sola pantalla:** nombre, teléfono, plan, inicio (hoy por defecto) y "pagado".

## 6. Reglas de negocio clave

- **El estado del cliente se calcula, no se guarda.** Según la `fecha_fin` de su última membresía:
  - `ACTIVO`: hoy ≤ `fecha_fin` − días de aviso.
  - `POR_VENCER`: le quedan ≤ `dias_aviso` días (7 por defecto, configurable por gimnasio).
  - `VENCIDO`: `fecha_fin` < hoy.
  - `SIN_MEMBRESIA`: nunca ha pagado.
- **Renovar** crea una nueva membresía que empieza al día siguiente del fin de la anterior (o hoy, si ya venció) y registra su pago.
- **Los pagos no se borran, se anulan.** Solo el dueño puede hacerlo, indicando el motivo.
- **Cada acción importante queda en la bitácora:** quién, qué, cuándo, y el antes y el después.

## 7. Requisitos no funcionales

- **Seguridad:** ver [ADR 0005](adr/0005-autenticacion-y-seguridad.md).
- **Privacidad (LFPDPPP 2025):** aviso de privacidad, consentimientos registrados, minimización de datos y ciclo de vida `ACTIVO → BLOQUEADO → SUPRIMIDO`. El aviso final debe revisarlo un abogado.
- **Usabilidad:** cualquier tarea frecuente en 3 clics o menos; funciona en tablet y celular.
- **Escalabilidad:** todas las tablas de negocio llevan `gimnasio_id` desde el día 1.

## 8. Stack

React + Vite + TypeScript (web) · Node + Express + TypeScript + Prisma (api) · Supabase (PostgreSQL + Auth) · GitHub Actions (CI). El detalle está en los [ADRs](adr/).

## 9. Glosario

| Término | Significado |
|---|---|
| **Cliente / socio** | Persona inscrita en el gimnasio |
| **Plan** | Producto que se vende ("Mensual", precio y duración) |
| **Membresía** | Derecho de uso de un cliente para un periodo concreto (inicio y fin) |
| **Pago** | Dinero recibido por una membresía |
| **Estado derivado** | Valor calculado a partir de otros datos, en lugar de guardarse |
| **Staff** | Usuarios del sistema: dueño y recepcionistas |
| **Tenant** | Cada gimnasio, en una arquitectura multi-gimnasio |
