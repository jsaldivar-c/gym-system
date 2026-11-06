# Pantallas y patrones UI/UX del software de gestión de gimnasios (admin para dueños y recepción)

> Investigación realizada el 2026-10-31. Fuentes: centros de ayuda de los proveedores, páginas de producto y reseñas en Capterra, G2 y Software Advice. Los help centers pueden ir por detrás de la versión actual de cada producto. No fue posible ver capturas reales del panel (requieren login o demo), así que la descripción visual sale de la documentación escrita.

## 1. Dashboard / pantalla de inicio: KPIs y widgets

### Takeaway
El patrón dominante es un dashboard de tarjetas/widgets: dinero del mes (cobrado, programado, vencido), asistencia/check-ins recientes, clases de hoy, tareas o seguimientos y alertas. Las tarjetas suelen ser clicables y llevan al reporte o lista filtrada. La visibilidad de los datos financieros depende del rol del usuario (dueño frente a recepcionista).

### Cited Findings
- **Gymdesk:** el dashboard es la primera pantalla tras el login y funciona como "centro de control". Sus widgets son: **Payments This Month** (pagos programados, recibidos y saldos vencidos), **Attendance** (check-ins de los últimos 7 días, clases populares y horas pico), **Today's Schedule & Bookings** (sesiones próximas y en curso, con el conteo de check-ins en vivo), **My Tasks** (seguimientos y recordatorios con fecha y contacto, asignables a cada miembro del staff), **Upcoming Birthdays** (opcional), **Notifications** (elegibles para promoción, emails fallidos, miembros inactivos) y **Overdue Payments** (miembros con saldo pendiente, importe, cargos y fecha de vencimiento, con acciones para reintentar el cobro o enviar un recordatorio) — [Gymdesk Docs: Dashboard](https://docs.gymdesk.com/en/help/docs/dashboard)
- Gymdesk: el staff solo ve totales de pagos, listas de vencidos y notificaciones del dueño si el dueño le da acceso. Los reportes integrados cubren pagos, asistencia, crecimiento de miembros y churn (calculado mensualmente sobre el total del mes anterior), además del ingreso medio por miembro desglosado en membresías, POS y pendiente — [Gymdesk: Gym Owner Dashboard](https://gymdesk.com/features/dashboard)
- Gymdesk publica una guía de KPIs que define el ingreso por miembro como ingreso cobrado dividido entre miembros activos, con un benchmark de 4.594 gimnasios (sobre todo de artes marciales) — [Gymdesk Blog: Gym KPI Dashboard](https://gymdesk.com/blog/gym-kpi-dashboard)
- **GymMaster:** el Home tiene varias **pestañas personalizables**, y lo que muestra es "personalizable por miembro del staff". Ofrece una vista en tiempo real de la actividad de miembros, el resumen de facturación, las reservas del día y las alertas del sistema. Al pasar el ratón sobre un valor aparece un tooltip que explica la métrica. Las tarjetas son clicables: por ejemplo, **Current Members** abre el reporte de miembros actuales. Incluye una tarjeta **Weekly Schedule** (al hacer clic en un día se ven las clases, las reservas y el staff asignado), un **Prospect Funnel** (embudo de leads por etapas, clicable hacia la página de Prospects) y el chatbot **Gymmy AI**, que responde preguntas sobre los datos del negocio — [GymMaster: Navigating your dashboard](https://www.gymmaster.com/help/help_navigating_your_dashboard/)
- **PushPress:** el dashboard del Control Panel (Core) incluye una sección **Classes** con un desplegable para elegir la clase del día y hacer check-in directamente desde ahí. El acceso y la visibilidad del dashboard dependen del rol del staff — [PushPress Help: coach check-in options](https://help.pushpress.com/en/articles/5099488-core-check-in-coach-check-in-options)
- **Glofox:** tiene una "Homepage" con métricas del rendimiento diario del estudio. Las analíticas avanzadas se venden aparte como **ABC Insights**, una librería de dashboards y reportes listos que, según la actualización de mayo de 2026, permite comparar sedes de forma centralizada. Los Reports no están disponibles en todos los planes — [ABC Insights for Glofox](https://support.glofox.com/hc/en-us/articles/48445086831892-ABC-Insights-for-Glofox); [Glofox Blog: ABC Insights](https://www.glofox.com/blog/abc-insights-for-glofox/); [Glofox: May 2026 updates](https://www.glofox.com/blog/abc-glofox-may-2026-product-updates/); [Glofox Pro Reports](https://support.glofox.com/hc/en-us/articles/46426342854932)
- Un reseñador de G2 sobre Glofox valora que el dashboard es "muy fácil de ver todo lo que necesito rápido" — [G2: ABC Glofox reviews](https://www.g2.com/products/abc-glofox/reviews?page=2)
- **Wodify:** su enfoque más diferencial es la retención. **Wodify Retain** usa machine learning para detectar clientes en riesgo, con una sensibilidad configurable entre el top 30% y el top 10% (por defecto). **Wodify AI** ofrece prompts como "miembros con asistencia reciente pero membresía por vencer", "pagos fallidos" y "ranking de riesgo de churn en los últimos 30 días" — [Wodify Help: Understand Wodify Retain](https://help.wodify.com/hc/en-us/articles/10064247597847-Understand-Wodify-Retain); [Wodify Help: Ask Wodify AI](https://help.wodify.com/hc/en-us/articles/41441026643991-Ask-Wodify-AI)
- Otro proveedor del sector (Eversports Manager) presenta una página de KPIs "Your studio at a glance", lo que confirma que el patrón de resumen de KPIs es estándar — [Eversports Manager: KPIs](https://helpcenter.eversportsmanager.com/1-kpis-key-performance-indicators)

### Inferences
- Un set mínimo razonable para un gimnasio pequeño, sacado de lo que repiten Gymdesk y GymMaster: (1) miembros activos, (2) ingresos del mes (cobrado frente a pendiente), (3) pagos vencidos como lista accionable, (4) check-ins de hoy y de los últimos 7 días, (5) membresías que vencen pronto y (6) clases o agenda de hoy.
- Patrón clave: **cada KPI debe llevar a una lista filtrada** (la tarjeta "Vencidos" abre la lista de miembros con filtro `status=vencido`). Así el dashboard se usa para actuar, no solo para mirar.
- Las listas "accionables" (vencidos con botón "reintentar o recordar", tareas) tienen más valor para recepción que los gráficos. Los gráficos interesan más al dueño. Esto sugiere un dashboard distinto, o widgets ocultos, según el rol.
- "Vencen esta semana" no aparece explícitamente como widget en Gymdesk según su documentación. Wodify lo cubre mediante IA/prompts. Un widget dedicado sería un diferenciador sencillo.

### Gaps
- No encontré documentación pública del dashboard de **Zen Planner** ni de **Mindbody** con la lista de widgets.
- No hay capturas verificables. El layout exacto (número de columnas, gráficos frente a números) no se pudo confirmar.
- La página del blog "Introducing the Glofox Homepage" devolvió un 404, así que no pude listar sus métricas concretas.

## 2. Lista de miembros: tabla frente a tarjetas, filtros, búsqueda y badges

### Takeaway
La documentación pública describe poco la lista de miembros. Lo confirmado es que los sistemas separan claramente **Miembro** de **Prospecto/Lead** y que trabajan con estados de membresía, tags y campos personalizados. Las listas suelen ser reportes filtrados (por ejemplo "Current Members Report").

### Cited Findings
- GymMaster tiene pantallas separadas **Find Member**, **Member Page** y **Add Member** en el menú lateral — [GymMaster Manual: Member Page reference](https://www.gymmaster.com/user-manual/manual_reference_findmember_memberpage/)
- En GymMaster, la tarjeta "Current Members" del dashboard abre el "Current Members Report", una lista de miembros actuales con los detalles de su membresía. Es decir, la "lista" se accede como reporte filtrado — [GymMaster: Navigating your dashboard](https://www.gymmaster.com/help/help_navigating_your_dashboard/)
- GymMaster usa **Member Tags** y campos personalizados, y distingue Member de Prospect con un toggle — [GymMaster Manual: Add Member](https://www.gymmaster.com/user-manual/manual_members_add)
- PushPress unificó leads y miembros en un único "People Profile" y eliminó la antigua página separada de Leads — [PushPress Help: Core People Profile Overview](https://help.pushpress.com/en/articles/12385934-core-people-profile-overview)
- Gymdesk muestra "estados de membresía", comunicaciones y pagos del miembro, y permite importar y exportar datos desde hojas de cálculo — [Gymdesk: Member Management](https://gymdesk.com/features/members)

### Inferences
- Para el admin de escritorio conviene una **tabla** (densidad de información, ordenación y exportación), con chips de filtro por estado (Activo, Por vencer, Vencido, Congelado, Prospecto) y un badge de color en cada fila. En móvil, la misma tabla puede convertirse en tarjetas.
- Unificar lead y miembro en una sola entidad "Persona" con estado (como hizo PushPress en 2025) simplifica tanto el modelo de datos como la UI.

### Gaps
- No encontré documentación pública con las columnas, los filtros o los colores exactos de la lista de miembros en ninguno de los siete productos. Habría que verificarlo con demos o vídeos.

## 3. Ficha o perfil del miembro

### Takeaway
El perfil es el "hub" del miembro y se organiza en **pestañas más una barra lateral** de resumen y acciones. PushPress evolucionó hacia una vista unificada (planes, créditos, facturación, notas y agenda en un solo layout).

### Cited Findings
- **GymMaster:** las tareas sobre un miembro se gestionan "a través de las distintas pestañas" de su Member Page. Las pestañas documentadas son **Details** (nombre, fecha de nacimiento, contacto de emergencia, foto, tags, acceso, campos personalizados), **Training** (programas de entrenamiento, promoción de grado), **Bookings** (reservas pasadas y futuras) y **Communication** (incluye Awards). Un **side menu** muestra las acciones clave y resúmenes como el snapshot de membresías actuales — [GymMaster Manual: Member Page sidebar](https://www.gymmaster.com/user-manual/manual_reference_findmember_memberpage_sidebar); [GymMaster: Bookings](https://www.gymmaster.com/user-manual/manual_members_bookings); [GymMaster: Trainers/Workouts](https://www.gymmaster.com/user-manual/manual_members_trainers_workouts); [GymMaster: Details side memberships](https://www.gymmaster.com/user-manual/manual_members_details_side_memberships)
- **PushPress Core:** el People Profile es una vista única para un lead o miembro que unifica planes, créditos, facturación, notas y agenda. También da acceso a waivers y acuerdos firmados y a notas internas del staff. Las notas de lead y de miembro se fusionaron en una sola sección "Notes" — [PushPress Help: Core People Profile Overview](https://help.pushpress.com/en/articles/12385934-core-people-profile-overview); [PushPress: People Profile](https://www.pushpress.com/features/people-profile)
- **PushPress Staff App (móvil):** el perfil muestra información básica, notas recientes, resultados de entrenamientos y planes y créditos (planes activos con fecha de inicio y fin, uso e información de facturación) — [PushPress Help: Member management in the Staff App](https://help.pushpress.com/en/articles/11030113-member-management-in-the-staff-app-by-pushpress)
- **Gymdesk:** cuentas familiares (un miembro principal controla el pago y los datos del resto), seguimiento del progreso (cinturones) y acceso por código, tarjeta o app — [Gymdesk: Member Management](https://gymdesk.com/features/members)

### Inferences
- Una estructura recomendable sería: **cabecera** (foto, nombre, badge de estado, días restantes y botones "Cobrar", "Renovar" y "Check-in") + pestañas **Resumen | Membresías | Pagos | Asistencia | Notas | Documentos**. La cabecera fija con las acciones principales evita navegar para hacer lo frecuente.
- Las notas internas del staff (no visibles para el miembro) son un patrón presente en todos los productos documentados.

### Gaps
- No encontré una lista oficial completa de las pestañas del perfil en Gymdesk, Glofox, Mindbody, Wodify ni Zen Planner.

## 4. Flujos rápidos: alta de miembro, registrar pago y renovar

### Takeaway
El flujo de alta mejor documentado (GymMaster) son unos **4-5 pasos**: datos personales → asignar membresía (categoría, plan y fecha de inicio) → pago (POS si es pago único, configuración de cobro si es recurrente) → guardar. Los pagos pendientes se resuelven desde la lista de vencidos del dashboard.

### Cited Findings
- **GymMaster, alta de miembro:**
  1. Menú izquierdo "Add Member" y toggle **Member/Prospect**.
  2. Pestaña Details con los campos obligatorios (más tags, foto, campos personalizados y acceso).
  3. "Add Membership": **Membership Category → Membership Plan → Start Date**, más campos condicionales según el tipo (First Payment Date y Up-Front Fee prorrateado) y "Save Membership".
  4. Pago: si es pago completo, lleva al **Point of Sale**; si es recurrente, guía la configuración del cobro.
  5. Billing: proveedor, modo ("Bill Member Automatically", "Don't Bill Automatically" o "Never Bill", este último para pagos solo presenciales), método de pago y "Save Billing".

  Un prospecto queda completo con solo guardar los datos — [GymMaster Manual: Add Member](https://www.gymmaster.com/user-manual/manual_members_add)
- **Gymdesk:** recomienda configurar primero las "Membership Options" (Memberships → Create New Membership, con tipo de precio Recurring o pago único). Hay varias formas de añadir miembros desde la vista Members, además del alta online o en una tablet en el gimnasio (con waiver, membresía y captura de pago). El POS también permite "procesar membresías" — [Gymdesk Docs: Getting Started](https://docs.gymdesk.com/help/gym-setup); [Gymdesk Docs: Personal training](https://docs.gymdesk.com/en/help/docs/personal-training); [Gymdesk: Member Management](https://gymdesk.com/features/members); [Gymdesk: POS](https://gymdesk.com/features/shop)
- **Gymdesk, registrar o cobrar vencidos:** desde el widget Overdue Payments del dashboard se abre la factura para reintentar el cobro o enviar un recordatorio — [Gymdesk Docs: Dashboard](https://docs.gymdesk.com/en/help/docs/dashboard)
- **PushPress:** la colección de ayuda de Core incluye artículos para pausar un plan, ajustar la fecha de cobro y una nueva "landing de alta de miembro", lo que indica que estas acciones viven en el perfil — [PushPress Help: Core collection](https://help.pushpress.com/en/collections/3271552-core)
- **Mindbody (contraejemplo):** los reseñadores se quejan de "muchos clics para completar cualquier función, especialmente en el punto de venta y las altas", y de tener que esperar a que cargue la pantalla en cada paso — [Capterra: Mindbody reviews](https://www.capterra.com/p/40229/MINDBODY/reviews/)

### Inferences
- El patrón de GymMaster (persona → plan → pago) es el estándar. Para un gimnasio pequeño se puede comprimir en **un formulario de una pantalla** (o un modal de 2 pasos) con nombre, teléfono o email, plan (que define precio y duración y calcula la fecha de fin automáticamente), fecha de inicio (hoy por defecto), método de pago y "pagado sí/no".
- "Renovar" debería ser un botón en el perfil y en la fila de la lista que **precargue el mismo plan** con inicio = fin anterior (o hoy, si ya venció), en 1-2 clics. Ningún proveedor documenta esto explícitamente, así que es una recomendación propia.
- Separar el catálogo de planes (configuración) de la venta (operación diaria), como hacen Gymdesk y GymMaster, simplifica el formulario de alta.

### Gaps
- No pude obtener el artículo de PushPress "How to add a new member" (404), ni los flujos de Glofox, Mindbody, Wodify o Zen Planner con conteo de pasos y campos.

## 5. Patrones móviles y de recepción (kiosco, búsqueda rápida)

### Takeaway
El kiosco de check-in en tablet es un patrón estándar: búsqueda por nombre + lista de "habituales" + selección de clase + firma de documentos + confirmación, con un PIN de staff para salir del modo kiosco. El staff también tiene apps móviles para hacer check-in en bloque.

### Cited Findings
- **PushPress Kiosk Mode** (en la Staff App): se activa desde Settings → Kiosk Mode con un **PIN de staff** para salir. El flujo del miembro es: (1) tocar "Check-in"; (2) **escribir su nombre** o tocarlo en la lista **Quick Check-ins** (habituales de esa franja, de la que desaparecen quienes ya reservaron o hicieron check-in); (3) elegir clase, Open Gym, cita o evento (sale su reserva o la siguiente disponible); (4) firmar los documentos requeridos (no se puede omitir); (5) ver la confirmación. El kiosco no puede saltarse las reglas del plan del miembro. Funciona en iOS 15+ y Android 5.1+ — [PushPress Help: Kiosk Mode](https://help.pushpress.com/en/articles/6636984-how-to-check-in-members-using-kiosk-mode-in-the-staff-app)
- PushPress retiró su antigua app "Check-In" independiente en favor de la Staff App en modo kiosco. La Staff App permite **check-in de todos los reservados en un clic**, añadir a quien no reservó y check-in en bloque (seleccionar todos y desmarcar ausentes). Desde Core → Schedule → Check-In se busca a un miembro y se confirma el check-in aunque se supere el cupo — [PushPress Help: coach check-in options](https://help.pushpress.com/en/articles/5099488-core-check-in-coach-check-in-options); [PushPress Help: Staff App check into class](https://help.pushpress.com/en/articles/6636569-staff-app-how-to-check-a-member-into-a-class-open-gym)
- **Gymdesk:** acceso por código de login, tarjeta de membresía o app, y alta en tablet en el propio gimnasio — [Gymdesk: Member Management](https://gymdesk.com/features/members)
- **Zen Planner Staff App:** permite ver la agenda completa (pasada, actual y futura), filtrar solo las sesiones propias, ver el cupo de las clases y editar perfiles de clientes — [AppFollow: Zen Planner Staff App](https://appfollow.io/android/zen-planner-staff-app/com.zenplanner.staffapp?country=us)
- **Glofox:** un reseñador indica que el dashboard de escritorio "no va bien en el móvil" y que el login de admin en la app tiene opciones limitadas — [Capterra: Glofox reviews p.5](https://www.capterra.com/p/136861/Glofox/reviews/?page=5)

### Inferences
- Para recepción, el patrón más útil es una **búsqueda global siempre visible** (por nombre, teléfono o DNI) que al seleccionar muestre el estado (badge verde, ámbar o rojo) y los botones "Check-in", "Cobrar" y "Renovar". Esto es una inferencia propia: ningún proveedor documenta la búsqueda global en detalle.
- Si se ofrece kiosco, la lista de habituales con nombres visibles plantea un tema de privacidad. PushPress permite desactivarla, lo que indica que algunos clientes lo pidieron.
- El admin debería ser responsive como mínimo para la búsqueda, el check-in y el cobro. Las quejas sobre Glofox muestran que un admin pensado solo para escritorio genera fricción.

### Gaps
- No encontré documentación de check-in por QR o PIN de miembro en estos proveedores dentro de las fuentes consultadas.

## 6. Quejas comunes de UX en reseñas

### Takeaway
La queja más repetida es **demasiados clics y complejidad** (sobre todo en Mindbody), seguida de la curva de aprendizaje por exceso de opciones (Wodify, Zen Planner) y de las interfaces poco adaptadas al móvil (Glofox). Gymdesk se posiciona en marketing justamente contra eso ("sin curva de aprendizaje").

### Cited Findings
- **Mindbody:** "muchos clics para completar cualquier función, especialmente en el punto de venta y las altas", "hay que ir y volver con demasiados clics en cada paso y esperar a que cargue la pantalla", la incorporación puede tardar hasta 2 meses y los nuevos empleados necesitan formación significativa. Ease of Use es 3,9/5 en Capterra UK — [Capterra: Mindbody reviews](https://www.capterra.com/p/40229/MINDBODY/reviews/); [Capterra UK: Mindbody](https://www.capterra.co.uk/software/40229/mindbody)
- Software Advice resume que Mindbody "se describe a menudo como complicado y poco amigable", con una interfaz anticuada, navegación confusa y una configuración larga — [Software Advice: Mindbody](https://www.softwareadvice.com/medical/mindbody-profile/)
- Un reseñador de Mindbody dice que tiene todo lo necesario, pero que "el gran reto es encontrarlo" — [Capterra: Mindbody reviews p.3](https://capterra.com/p/40229/MINDBODY/reviews/?page=3)
- G2 señala que en Mindbody tareas simples como configurar una opción de precio requieren muchos clics — [G2: Mindbody review](https://www.g2.com/survey_responses/mindbody-review-817051)
- **Wodify:** "hay MUCHAS opciones en el back end, así que aprender e identificar lo que te sirve lleva tiempo", con una curva de aprendizaje en funciones avanzadas. Aun así, tiene 4,7/5 en G2 y muchos usuarios lo consideran intuitivo (parte de estas valoraciones vienen de resúmenes de IA de G2) — [G2: Wodify reviews](https://www.g2.com/products/wodify/reviews)
- **Zen Planner:** "interfaz confusa a veces, con demasiadas opciones", el seguimiento de entrenamientos es tosco y una reseña se titula "Great Features - Not Intuitive". En cambio, Software Advice le da 4,1/5 en facilidad de uso — [Capterra: Zen Planner reviews](https://capterra.com/p/134351/Zen-Planner/reviews/); [G2: Zen Planner reviews](https://www.g2.com/products/zen-planner/reviews_and_filters); [Software Advice: Zen Planner](https://www.softwareadvice.com/fitness/zen-planner-profile)
- **Glofox:** piden poder copiar o duplicar elementos (membresías, clases) dentro del dashboard. El escritorio va mal en el móvil. En general se valora la facilidad de uso (≈4,5/5 en G2) — [Capterra: Glofox reviews p.5](https://www.capterra.com/p/136861/Glofox/reviews/?page=5); [G2: ABC Glofox](https://www.g2.com/products/abc-glofox/reviews)
- **Gymdesk** se promociona como "Gym Management Software, Without the Learning Curve" — [Gymdesk](https://gymdesk.com/?c6f10e78_page=3)

### Inferences
- Principios a extraer: (1) minimizar los pasos de alta y cobro; (2) no exponer todas las opciones de configuración en la operación diaria (divulgación progresiva); (3) permitir duplicar planes o clases; (4) que la recepción pueda usar el sistema sin formación larga; (5) usar un layout responsive.

### Gaps
- No revisé reseñas específicas de UX de GymMaster ni de PushPress.

## 7. Referencias de diseño públicas (Dribbble, Behance y GitHub)

### Takeaway
Existen shots en Dribbble y varios proyectos open source, pero la mayoría son proyectos de estudiantes o de portafolio. Sirven como inspiración visual, no como referencia de UX validada.

### Cited Findings
- **Dribbble:** Design Yow tiene "Gym Management - Dashboard", que centraliza la actividad de miembros, los horarios de entrenadores, los ingresos y las métricas operativas. uibillal18 tiene varios "Fitness Management Dashboard". Hay además una colección "Dashboards" de thdesignse — [Dribbble: Design Yow](https://dribbble.com/designyow?page=2); [Contra: Design Yow work](https://contra.com/designyow/work); [Dribbble: uibillal18](https://dribbble.com/uibillal18); [Dribbble: thdesignse Dashboards](https://dribbble.com/thdesignse/collections/7203499-Dashboards)
- **AdminLTE** tiene un artículo con plantillas de dashboard fitness y menciona los proyectos open source **Gymie** (Laravel, con API JSON) y **MotionGym** (Laravel + Voyager: miembros, pagos y clases) — [AdminLTE: Fitness dashboard templates](https://adminlte.io/blog/fitness-dashboard-templates/)
- **GitHub:**
  - **Fitness Kingdom gym-ms** (Django + MySQL): dashboard de manager con gráficos de ingresos y gastos, historial de transacciones y horarios. Su dashboard de empleado no está actualizado — [GitHub: fitness-kingdom-gym-ms](https://github.com/shz-code/fitness-kingdom-gym-ms)
  - **Gym Hero** (Rails, MIT): dashboard con conteos de miembros y clases — [GitHub: gym-hero](https://github.com/antdp425/gym-hero)
  - **smartgymnash** (Node): miembros, entrenadores, equipos, estado de membresía y renovación — [GitHub: smartgymnash](https://github.com/rahulp-github/smartgymnash)
  - **CoreZone** (HTML/CSS/JS): miembros, entrenadores, pagos y recibos — [GitHub: CoreZone](https://github.com/dhanshrii2006/CoreZone)
  - **GYM-Management-System** (PHP + MySQL) — [GitHub: JehanKandy](https://github.com/JehanKandy/GYM-Management-System)
- **Gymstick Pro** (CodeCanyon, React/Next.js + Node): producto comercial con paneles para admin, entrenador, miembro, vendedor y empleado — [CodeCanyon: Gymstick Pro](https://codecanyon.net/item/gymstick-pro-gym-management-system-website-trainer-panel-vendor-panel-admin-panel-mern/56100249)

### Inferences
- Para un proyecto en React, la mejor referencia de UX son los help centers de Gymdesk, GymMaster y PushPress (flujos reales y probados). Dribbble sirve para la estética. Los repos de GitHub sirven sobre todo como referencia del modelo de datos (miembros, planes, pagos), no del diseño.

### Gaps
- No busqué en Behance específicamente. No verifiqué la licencia ni la actividad reciente de Gymie y MotionGym. No pude ver el contenido completo de los shots de Dribbble.
