# Funciones MVP y modelos de datos del software de gestión de gimnasios (gimnasios pequeños y medianos)

Contexto: notas para definir el alcance MVP de un sistema propio para un gimnasio de una sola sede, operado por un dueño y recepcionistas, con cuota mensual fija. Investigación hecha en octubre de 2026. Varias páginas oficiales (Glofox, Wodify, Capterra ES) respondieron con HTTP 403 al intento de lectura completa. En esos casos uso los fragmentos que devolvió el buscador y lo señalo.

## 1. ¿Qué funciones trae el plan básico o de entrada de cada producto (Gymdesk, Glofox, PushPress, Mindbody, Wodify, Zen Planner, alternativas latinoamericanas)?

### Takeaway
Los productos líderes no recortan funciones en su plan de entrada: cobran según el número de miembros activos. El plan más barato ya incluye registro de miembros, membresías y planes, facturación y cobros, control de acceso o check-in, reportes básicos y gestión de staff. Lo que se vende como extra suele ser marketing automatizado, app con marca propia, sitio web, programación de entrenamientos y analítica avanzada. Para un MVP de una sola sede con cuota fija, el núcleo común es este: miembros, plan o membresía con vigencia, registro de pagos, estado (activo, vencido o moroso) y un panel con vencimientos.

### Cited Findings
**Gymdesk**
- Cobra por miembros activos y todas las funciones están en todos los niveles. Una comparativa lista Micro (hasta 50 miembros) a $75/mes, Small (51 a 100) a $100, Medium (101 a 200) a $150, Large (201 a 400) a $200 y Enterprise (más de 400) con precio a medida. Cita la página de precios de Gymdesk de julio de 2026 — [OfferingTree, Mindbody vs GymDesk](https://www.offeringtree.com/?p=39058); [Costbench](https://costbench.com/software/gym-management/gymdesk/)
- Hay conflicto en la estructura: otro artículo de OfferingTree menciona planes Individual desde $26/mes y Studio de $100 a $225/mes con facturación anual. G2 lista 4 ediciones entre $75 y $200 — [OfferingTree, Momence vs GymDesk](https://www.offeringtree.com/?p=40014); [G2](https://www.g2.com/products/martial-arts-on-rails/pricing)
- No tiene plan gratuito (junio de 2026). Ofrece una prueba de 30 días. Incluye cuentas de staff ilimitadas, sitio web y facturación a miembros — [Costbench free plan](https://costbench.com/software/gym-management/gymdesk/free-plan/)

**PushPress**
- El plan "Core Free" es gratuito para siempre e incluye miembros, leads, admins y staff ilimitados. También incluye gestión de miembros, agenda, facturación y pagos, y las apps de miembros, staff y pantallas. La página dice haber verificado estos datos el 30/10/2026 — [Costbench, PushPress Free Plan](https://www.costbench.com/software/gym-management/pushpress/free-plan/)
- La contrapartida es una comisión de procesamiento más alta. Costbench indica 4.99% + $0.30 por tarjeta y 2.89% + $0.30 por ACH. Otras fuentes dicen 4.19% + $0.30 por tarjeta — [Costbench](https://www.costbench.com/software/gym-management/pushpress/free-plan/); contradicho por [FitGap](https://us.fitgap.com/products/022768/pushpress) y [Costbench (página general)](https://costbench.com/software/gym-management/pushpress/)
- El plan gratuito excluye la programación avanzada de entrenamientos y el seguimiento de rendimiento. Los reportes y la analítica avanzados son de pago. Los planes pagos Core Pro y Core Max cuestan $159 y $229/mes según una fuente — [Costbench](https://costbench.com/software/gym-management/pushpress/)
- GetApp menciona un límite de 100 miembros, lo que contradice el "ilimitado" de Costbench — [GetApp](https://www.getapp.com/health-fitness-software/a/pushpress)

**Zen Planner** (fuente: blog de Gymdesk, que es competidor; posible sesgo)
- El plan Studio cobra por miembros activos. Arranca en $99/mes para 0 a 45 miembros, pasa a $189 para 76 a 100 y llega a $289 para más de 251 — [Gymdesk blog, Zen Planner Review 2026](https://gymdesk.com/blog/zen-planner-review)
- El plan de entrada incluye apps de miembro y staff, membresías y facturación, venta minorista, reportes y asistencia, agenda de staff, cálculo de nómina, automatizaciones y seguimiento de entrenamientos. El sitio web ($99/mes), el marketing "Engage" ($249/mes) y la app con marca ($39/mes) se compran por separado — [Gymdesk blog](https://gymdesk.com/blog/zen-planner-review)

**Glofox**
- La gestión de membresías incluye estados (Activa, Pausada, Morosa, Sin membresía), pausa, cancelación y el reporte "Lost Members", que reúne membresías canceladas o expiradas — [Glofox Support, Membership Status](https://support.glofox.com/hc/en-us/articles/46428938895380-Membership-Status); [Lost Members Report](https://support.glofox.com/hc/en-us/articles/46458524674068-How-to-Use-the-Lost-Members-Report)

**Wodify**
- Tiene un reporte de membresías con una vista de "expiring": membresías que van a vencer porque no se renuevan automáticamente. El perfil del cliente tiene una pestaña "Membership & Payments" y un "Activity Feed" — [Wodify Help, Reporting Memberships](https://help.wodify.com/hc/en-us/articles/8239384735255-Reporting-Memberships); [Wodify, People Reporting](https://help.wodify.com/hc/en-us/articles/360058761813-Understanding-People-Reporting)

**GymMaster**
- La pestaña de Membresías del perfil de cada miembro permite agregar membresías, poner pausas ("holds") y regalar tiempo ("gifted time"). Los tipos de membresía se configuran aparte, en Settings — [GymMaster Manual](https://gymmaster.com/user-manual/manual_managememberships)

**Alternativas latinoamericanas**
- Fitco apunta a estudios boutique y gimnasios de LatAm. Incluye membresías, ventas en línea, cobros (con Stripe y Mercado Pago) y CRM y retención. No publica precios: menciona "3 planes diferentes" a medida — [Capterra ES, Fitco](https://www.capterra.es/software/182579/fitco); [ComparaSoftware](https://www.comparasoftware.com/fitco)
- Boxmagic (Chile) es un sistema todo en uno con membresías, cobros recurrentes, reservas de clases, control de alumnos, reportes y pasarelas de pago — [Capterra, Boxmagic](https://www.capterra.com/p/275373/Boxmagic/); [Descubre.vc](https://www.descubre.vc/boxmagic)
- AgendaPro (versión México) ofrece seguimiento de pagos, adeudos y vigencia de membresías, cobros automáticos y control de caja — [AgendaPro MX](https://agendapro.com/mx/gimnasio/software-para-gimnasio)
- El plan Starter de Gym&i incluye hasta 80 miembros, 2 staff, check-in por QR y cobros automáticos — [ComparaSoftware, Gym&i](https://www.comparasoftware.com/gymi)
- Productos populares en México según un comparador: iActiva GymAdmin, Smartgym, Gymcatch, Gym&i, PerfectGym, TIMP, Klasius, Evo y Trainer UP — [ComparaSoftware MX](https://www.comparasoftware.com/software-para-gimnasios)
- En gimnasios chicos, la validación de acceso suele ser manual: el recepcionista ve el estado del socio en pantalla. Los molinetes con QR o biometría son para gimnasios más grandes. Un argumento de venta frecuente es reemplazar varias planillas de Excel que se desincronizan — [Yo-Facturo blog](https://yo-facturo.com/blog/sistema-gestion-gimnasio-fitness/)

### Inferences
- Como el mercado no recorta funciones en el plan de entrada, la referencia del "mínimo aceptable" es alta. Aun así, para un gimnasio con cuota fija mensual y cobro presencial (efectivo o terminal), lo crítico es más acotado. Primero: el padrón de socios, un plan o tarifa, el registro manual de pagos, la vigencia calculada y un panel de vencidos y por vencer. Después: check-in con validación de estado. Lo demás (reservas de clases, marketing, app, sitio web, nómina, POS de productos) puede quedar fuera del MVP.
- Las opciones latinoamericanas destacan el cobro con pasarelas locales (Mercado Pago) y la "vigencia" o "adeudo". Esto confirma que el vocabulario local gira en torno a "vigente", "vencido" y "adeudo".

### Gaps
- No encontré precios oficiales ni el contenido del plan de entrada de Mindbody y Wodify en 2026. Las páginas de Wodify devolvieron 403 y Mindbody no apareció con datos concretos.
- Fitco y Boxmagic no publican precios ni el detalle de cada plan. Capterra ES devolvió 403.
- No verifiqué directamente gymdesk.com/pricing. Los precios de Gymdesk y PushPress salen de agregadores con datos que se contradicen.
- No investigué Nubimetrics (es analítica de e-commerce, no software de gimnasios) ni productos colombianos específicos.

## 2. ¿Qué datos del socio capturan (identidad, contacto, fecha de nacimiento, contacto de emergencia, foto, waiver, notas) y cuáles son obligatorios?

### Takeaway
El patrón dominante es este: pocos campos de identidad obligatorios (nombre, apellido y casi siempre email), más bloques opcionales que el gimnasio configura como visibles u obligatorios. Esos bloques son dirección, foto, contacto de emergencia, condiciones médicas, waiver y campos personalizados. La fecha de nacimiento aparece como obligatoria en al menos una configuración de Mindbody.

### Cited Findings
- Gymdesk: en el formulario de alta, cada campo se muestra u oculta con un "ojo" y se marca obligatorio con un asterisco. Los campos de la sección personal son fijos, salvo State, que se puede ocultar — [Gymdesk Docs, Sign-up form](https://docs.gymdesk.com/en/help/docs/sign-up-form)
- Gymdesk, dirección: calle, ciudad, estado, código postal y país. La sección completa puede ocultarse o quedar opcional — [Gymdesk Docs, Sign-up form](https://docs.gymdesk.com/help/sign-up-form)
- Gymdesk, foto: se captura o se sube. Puede ocultarse o hacerse obligatoria con "Require Photo" — [Gymdesk Docs](https://docs.gymdesk.com/help/sign-up-form)
- Gymdesk, la sección "Contacts" sirve para contactos de emergencia, padres o familiares. Se puede renombrar, ocultar u obligar — [Gymdesk Docs](https://docs.gymdesk.com/help/sign-up-form)
- Gymdesk, otros campos: código de check-in (obligatorio u oculto), condiciones médicas (ocultable), tipo de miembro elegible en el alta y campos personalizados (talla, categoría de peso, etc.) que pueden ser obligatorios — [Gymdesk Docs](https://docs.gymdesk.com/help/sign-up-form); [Gymdesk Member Settings](https://docs.gymdesk.com/help/member-settings)
- Gymdesk, waiver: en Member Settings, "Require waiver signature during sign-up" vuelve obligatoria la firma del waiver para completar el alta. Los documentos ligados a una membresía concreta se asignan aparte — [Gymdesk Member Settings](https://docs.gymdesk.com/help/member-settings); [Sign-up form](https://docs.gymdesk.com/help/sign-up-form)
- Mindbody: una guía de una organización cliente indica como obligatorios First name, Last name, Email y Birthday. Es la configuración de un solo sitio, así que puede variar — [TOCA Football, MBO: Create a Customer Profile](https://support.tocafootball.com/mbo-create-a-customer-profile)
- Mindbody: según una referencia de integración Zapier, la API expone el contacto de emergencia como nombre, email y teléfono (EmergencyContactInfoName, Email, Phone) — [APIANT, Mindbody client](https://help.apiant.com/09-zapier-mindbody-client-instant)
- GymMaster tiene una sección específica de contacto de emergencia en los detalles del miembro — [GymMaster Manual, emergency](https://gymmaster.com/user-manual/manual_members_add_details_emergency)
- Wodify: el perfil muestra las respuestas del cuestionario del waiver en "Membership & Payments" y un Activity Feed con fecha, hora y quién hizo cada cambio — [Wodify Help](https://help.wodify.com/hc/en-us/articles/360058761813-Understanding-People-Reporting)

### Inferences
- Propuesta de modelo `Socio` para el MVP:
  - Obligatorios: nombre, apellido, teléfono (en LatAm suele ser más útil que el email para avisos por WhatsApp) y fecha de alta.
  - Recomendados: fecha de nacimiento, email, documento de identidad (DNI, CURP o cédula; no lo vi en las fuentes anglosajonas, pero es habitual en LatAm), foto y contacto de emergencia (nombre, teléfono, parentesco).
  - Opcionales: dirección, condiciones médicas, notas internas, waiver o consentimiento firmado con fecha, y código de acceso.
- La bitácora de auditoría (quién cambió qué y cuándo) que tienen Wodify y otros conviene incluirla desde el inicio, aunque sea simple, porque varios recepcionistas tocan los mismos datos.

### Gaps
- No encontré documentación oficial de Mindbody, Glofox ni PushPress sobre qué campos son obligatorios por defecto.
- No encontré fuentes sobre campos de identidad fiscal (RFC, NIT) ni documento de identidad en los productos latinoamericanos.
- Gymdesk no documenta en esa página los valores por defecto de nombre, email, teléfono, fecha de nacimiento o género.

## 3. ¿Cómo separan membresía y pago (períodos, fechas de inicio y fin, pausa, estados, pagos parciales, métodos de pago, recibos)?

### Takeaway
Todos separan la membresía, que es el derecho de uso con fecha de inicio, fecha de fin o vencimiento y un plan o tipo, de los pagos y facturas, que son transacciones ligadas a esa membresía. La pausa extiende la fecha de fin o la próxima fecha de cobro por la cantidad de días pausados y suspende el acceso. Los estados se derivan de las fechas y del resultado del último cobro.

### Cited Findings
- Glofox: una membresía está activa si su fecha de inicio ya pasó, su vencimiento es futuro y no está pausada — [Glofox Support, Membership Status](https://support.glofox.com/hc/en-us/articles/46428938895380-Membership-Status)
- Glofox, pausa: suspende el cobro y el acceso hasta una fecha futura. Solo se pueden pausar membresías recurrentes, y la próxima fecha de cobro se corre tantos días como dure la pausa. Desde 2026 el socio puede pausarse solo desde la app — [Glofox, How to Pause](https://support.glofox.com/hc/en-us/articles/46427593251732); [Member Self-pause](https://support.glofox.com/hc/en-us/articles/50299668797716-Member-Self-pause-for-Memberships)
- Glofox, cancelación: se hace desde la pestaña Membership, en Actions, opción Cancel Membership — [Glofox, How to Cancel](https://support.glofox.com/hc/en-us/articles/46427393245844-How-to-Cancel-a-Membership)
- GymMaster, hold: congela el plan y quita sus beneficios, incluido el acceso. La fecha de fin se extiende por la duración de la pausa. Hay dos modos de cobro:
  - "Adjust": se dejan de generar cobros, pero puede haber prorrateos.
  - "Billing Delay": no hay prorrateo, se conservan los días ya pagados y la próxima fecha de cobro se corre.
  Puede terminar sola cuando el socio vuelve al gimnasio, y una pausa aplicada después de un pago puede dejar saldo a favor — [GymMaster Manual, Holds FAQ](https://www.gymmaster.com/user-manual/manual_members_memberships_holds_faqs)
- GymMaster tiene "Gifted Time" como alternativa para dar acceso gratis, distinto de la pausa — [GymMaster Manual](https://gymmaster.com/user-manual/manual_managememberships)
- Rock Gym Pro: la pausa empieza en la próxima fecha de cobro, puede tener una tarifa de pausa distinta, y al reactivar puede tocar cobrar cuotas pendientes — [Rock Gym Pro Support](https://support.rockgympro.com/hc/en-us/articles/360057048631)
- Gymdesk: separa Invoices, Payments, Recurring y Discounts como entidades de facturación. Los permisos permiten modificar el monto de una factura y hacer reembolsos — [Gymdesk Docs, Managers](https://docs.gymdesk.com/help/managers)
- Wodify: distingue membresías con renovación automática de las que vencen. Las que no se renuevan solas aparecen como "expiring" — [Wodify Help, Reporting Memberships](https://help.wodify.com/hc/en-us/articles/8239384735255-Reporting-Memberships)
- Glofox: si el pago fallido se reintenta con éxito o se condona ("written off"), el socio vuelve a estar activo. Es decir, la deuda se puede cancelar sin cobrarla — [Glofox, Membership Status](https://support.glofox.com/hc/en-us/articles/46428938895380-Membership-Status)
- Proveedores latinoamericanos destacan el registro de pagos en efectivo o TPV en recepción, el control de caja y, en México, la facturación electrónica CFDI — [AgendaPro MX](https://agendapro.com/mx/gimnasio/software-para-gimnasio); [Yo-Facturo](https://yo-facturo.com/blog/sistema-facturacion-gimnasio-suscripciones/)

### Inferences
- Modelo sugerido para el MVP (cuota mensual fija, cobro presencial):
  - `Plan`: nombre, precio, duración en meses o días, activo o inactivo.
  - `Membresía`: socio, plan, fecha_inicio, fecha_fin, estado, precio_acordado. El precio se guarda en la membresía porque el plan puede subir de precio después.
  - `Pago`: membresía o socio, monto, fecha, método (efectivo, tarjeta, transferencia), registrado_por (usuario del staff), número de recibo o folio, nota y estado (válido o anulado; anular en vez de borrar).
  - `Pausa`: membresía, fecha_inicio, fecha_fin, motivo. Al cerrarse, extiende fecha_fin.
- Con cuota fija, el modelo más simple es "un pago extiende la vigencia un período". Admitir pagos parciales complica el cálculo, porque obliga a manejar saldo pendiente por período. Recomendación: en el MVP, un pago cubre un período completo, con la opción de registrar un "adeudo" o saldo como campo explícito si el dueño lo necesita.
- El estado debería calcularse a partir de las fechas, y no guardarse a mano, para evitar inconsistencias. La excepción es "cancelada", que es una decisión explícita.

### Gaps
- No encontré documentación clara sobre pagos parciales o abonos en ninguno de los productos.
- No obtuve detalles de recibos (formato, numeración) en las fuentes consultadas.
- No obtuve la diferencia formal entre "Cancelled" y "Expired" en Glofox (el artículo devolvió 403).

## 4. ¿Cómo definen y muestran "moroso o vencido", "por vencer" y "activo"?

### Takeaway
"Activo" significa dentro del período de vigencia y sin pausa. "Moroso" (overdue) se dispara por un cobro fallido o un pago no recibido, a veces con un período de gracia antes de bloquear el acceso. "Por vencer" o "expiring" se muestra en reportes o listados de membresías que terminan pronto sin renovación automática.

### Cited Findings
- Glofox define cuatro estados (Active, Paused, No Membership, Overdue). Overdue es el socio cuyo último pago recurrente falló, y pierde el acceso al club 7 días después del fallo. Vuelve a Active si el reintento tiene éxito o la deuda se condona — [Glofox Support, Membership Status](https://support.glofox.com/hc/en-us/articles/46428938895380-Membership-Status)
- El reporte "Lost Members" de Glofox incluye las membresías Cancelled o Expired, usadas para retención — [Glofox, Lost Members Report](https://support.glofox.com/hc/en-us/articles/46458524674068-How-to-Use-the-Lost-Members-Report)
- Wodify: la vista de memberships "expiring" muestra a los clientes cuya membresía no está en renovación automática y va a vencer — [Wodify Help](https://help.wodify.com/hc/en-us/articles/8239384735255-Reporting-Memberships)
- Otros proveedores (Fitune, Club OS, FitnessForce) tienen reportes específicos de "upcoming membership expirations" o "expiration list", lo que confirma que es un reporte estándar del sector — [Fitune](https://help.fitune.io/en/articles/upcoming-membership-expirations); [Club OS](https://knowledge.club-os.com/en_US/mms-reporting/expiration-list-report); [FitnessForce](https://support.fitnessforce.com/portal/en/kb/articles/membership-expiry-report-6-1-2021)
- Proveedores de Argentina y México destacan mostrar "vencimientos y estado de pago al día" en recepción, sin Excel — [Yo-Facturo](https://yo-facturo.com/blog/sistema-gestion-gimnasio-fitness/); [AgendaPro MX](https://agendapro.com/mx/gimnasio/software-para-gimnasio)

### Inferences
- Reglas sugeridas para el MVP (configurables):
  - Activo: hoy entre fecha_inicio y fecha_fin, sin pausa vigente.
  - Por vencer: fecha_fin dentro de los próximos N días (por ejemplo 7).
  - Vencido o moroso: hoy pasó fecha_fin y no hay pago nuevo. Puede tener un período de gracia de G días, como los 7 de Glofox, antes de considerarse bloqueado.
  - Pausado: hay una pausa vigente.
  - Cancelado: marcado a mano.
  - Sin membresía: socio sin membresía.
- En un gimnasio con cobro presencial no hay "cobro fallido", así que "moroso" equivale a "venció y no pagó". Con un período de gracia se distinguen "vencido en gracia" y "vencido bloqueado".
- Para el panel: tarjetas con el conteo de activos, por vencer (N días), vencidos y pausados, más listas accionables (llamar o enviar WhatsApp). Usar colores tipo semáforo (verde, ámbar, rojo) en la ficha del socio y en el check-in.

### Gaps
- No encontré los valores por defecto de "por vencer" (cuántos días) en Gymdesk, PushPress, Zen Planner ni Mindbody.
- No encontré capturas o especificaciones de cómo se ven los paneles de inicio en los planes básicos.

## 5. ¿Qué roles y permisos de staff existen (dueño, admin, recepción)?

### Takeaway
Gymdesk muestra el patrón típico: un dueño único con poderes exclusivos (staff, configuración de facturación y permisos), roles de gestión con permisos granulares por módulo, y un modo "Front Desk" limitado (check-in, en una tablet compartida). Los permisos de cobro se separan: ver pagos, modificar montos y reembolsar son permisos distintos.

### Cited Findings
- Gymdesk, tipos de staff:
  - Manager: acceso según permisos, sin perfil de instructor.
  - Instructor: los mismos permisos que Manager, más asignación a clases y nómina.
  - Front Desk: solo accede al Front Desk Mode, pensado como login compartido en una tablet pública.
  — [Gymdesk Docs, Managers](https://docs.gymdesk.com/help/managers)
- Gymdesk, dueño: es quien creó la cuenta. Solo el dueño puede agregar o quitar staff, cambiar la configuración de facturación del gimnasio y cambiar permisos. La propiedad se transfiere con "Make Owner" — [Gymdesk Docs, Managers](https://docs.gymdesk.com/help/managers)
- Gymdesk, permisos granulares:
  - Miembros: ver miembros, ver facturas (requiere ver miembros), editar miembros, check-in, configuración de miembros y etiquetas.
  - Facturación: lista de pagos, modificar pagos (cambiar montos y reembolsar), reembolsar pagos, configuración de facturación y procesador de pagos.
  - POS: crear venta y gestionar productos.
  - Otros: sitio web, marketing, gestión de staff, tareas, nómina, agenda y configuración del gimnasio.
  Todo el staff ve el Dashboard por defecto. No hay un permiso separado para reportes — [Gymdesk Docs, Managers](https://docs.gymdesk.com/help/managers)
- GymMaster tiene una sección de permisos para cada miembro del staff — [GymMaster Manual, staff permissions](https://www.gymmaster.com/user-manual/manual_staffmembers_add_staff_details_permissions)
- Gym&i limita su plan Starter a 2 cuentas de staff, es decir, algunos proveedores latinoamericanos cobran por staff. Gymdesk y PushPress Free ofrecen staff ilimitado — [ComparaSoftware, Gym&i](https://www.comparasoftware.com/gymi); [Costbench Gymdesk](https://costbench.com/software/gym-management/gymdesk/free-plan/); [Costbench PushPress](https://www.costbench.com/software/gym-management/pushpress/free-plan/)

### Inferences
- Para el MVP bastan dos roles fijos, en lugar de permisos granulares:
  - Dueño o admin: todo, incluidos planes y precios, usuarios del staff, anular pagos, reportes de ingresos y exportación.
  - Recepcionista: dar de alta y editar socios, registrar pagos, hacer check-in, ver estados y vencimientos.
  Que un recepcionista no pueda borrar ni anular pagos, ni cambiar precios, es el control antifraude más importante y refleja la separación de Gymdesk entre "Payment List" y "Modify/Refund Payments".
- Cada pago y cada cambio debe guardar quién lo hizo (`registrado_por`) para cuadrar la caja por turno.

### Gaps
- No obtuve documentación de roles de Zen Planner, Glofox, PushPress, Mindbody ni Wodify. La búsqueda de Zen Planner devolvió solo otros productos.
- No encontré cómo manejan el corte de caja por turno o por recepcionista los productos analizados.
