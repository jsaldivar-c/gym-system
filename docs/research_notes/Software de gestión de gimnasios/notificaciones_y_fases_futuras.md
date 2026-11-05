# Recordatorios de pago, notificaciones y módulos post-MVP (inventario de equipo, progreso de socios)

> Notas de investigación al 31-oct-2026. Contexto: gimnasio pequeño de una sola sede en México/LatAm. Muchas fuentes son blogs de proveedores (marketing): se marca cuando aplica. Varias páginas de ayuda (Wodify, Glofox, PushPress) devolvieron 403/404 al leerlas completas, así que algunos datos vienen solo de fragmentos de búsqueda.

## 1. ¿Cómo envían recordatorios de pago Gymdesk, Glofox, PushPress, Mindbody, Wodify y alternativas latinoamericanas? (canales, tiempos, destinatarios)

### Takeaway
El patrón dominante en software anglosajón es "cobro automático con tarjeta → reintentos automáticos → aviso al socio por email (SMS opcional, con costo) con link de pago → reporte/alerta para staff". En LatAm el canal principal es WhatsApp, con avisos antes del vencimiento (p. ej. 5 días antes), el día de vencimiento/vencido y agradecimiento al pagar, porque muchos pagos son en efectivo, SPEI u OXXO y no hay cargo recurrente con tarjeta.

### Cited Findings
**Glofox**
- Cuando falla un pago recurrente con tarjeta (Stripe), Glofox lo reintenta automáticamente 3 veces más, a intervalos de 1 día desde la fecha del fallo inicial. — [Glofox Support: What Happens When a Recurring Payment Fails?](https://support.glofox.com/hc/en-us/articles/46444686087316) (solo fragmento de búsqueda; la página dio 403)
- Si sigue fallando, se envía al socio un "Payment Link" por email o SMS, para que pague sin intervención del staff. — [Glofox Support: Using Payment Links to Collect Failed Subscription Payments](https://support.glofox.com/hc/en-us/articles/46457162945300); [Glofox blog: payment links](https://www.glofox.com/blog/payment-links-recover-overdue-funds/)
- Glofox permite crear workflows con acciones: enviar email, enviar SMS, enviar push y "crear tarea para el staff". También tiene un "Failed Payment Report". — [Glofox Support: Understanding the Failed Payment Report](https://support.glofox.com/hc/en-us/articles/46458001077780)

**Wodify**
- Cada noche Wodify envía al "Billing Contact" del negocio un email con el resumen de la facturación automática: facturas procesadas y fallidas con su mensaje de error. El contacto debe poder recibir emails de Wodify. — [Wodify Help: Wodify Payments Stripe Billing Error Messages](https://help.wodify.com/hc/en-us/articles/360011285453) (solo fragmento; la página dio 403)

**PushPress**
- Tiene "core system emails". Uno de ellos, "Billing Method Updated", va a los administradores cuando un socio cambia su método de pago. — [PushPress Help: Core System Emails](https://help.pushpress.com/en/articles/5593053-core-system-emails) (fragmento; la URL dio 404 al leerla)
- El motivo del fallo (fondos insuficientes, tarjeta rechazada) se ve abriendo la factura fallida en el perfil del socio. — [PushPress Help: Charge Failed](https://help.pushpress.com/en/articles/508472-core-payments-charge-failed)
- No encontré documentación de una alerta automática al staff por cada pago fallido ni de los tiempos de reintento de PushPress.

**Gymdesk**
- Hay recordatorios automáticos para socios que no han registrado sus datos de cobro tras el email de bienvenida. Además, el admin puede filtrar Members por "No Card on File" y enviar un recordatorio masivo de pago. — [Gymdesk Docs: Recollecting credit cards](https://docs.gymdesk.com/en/help/docs/recollecting-credit-cards-in-gymdesk)
- El dashboard del dueño muestra los pagos vencidos (socios con saldo, monto y fecha), los 5 pagos vencidos más recientes y las suscripciones detenidas. — [Gymdesk Docs: Dashboard](https://docs.gymdesk.com/en/help/docs/dashboard); [Gymdesk: Owner Dashboard](https://gymdesk.com/ja/features/dashboard)

**Mindbody**
- Hay un auto-email configurable "Contract/Autopay Credit Card Expiring" para prevenir rechazos por tarjeta vencida, más alertas de autopays fallidos. — [Material de capacitación (exceedlms), sin confirmar que sea oficial de Mindbody](https://bold.exceedlms.com/student/path/401805/activity/346446)
- "Card Updater" es un servicio de pago que actualiza automáticamente vencimientos y tarjetas reemplazadas, a USD $1 por tarjeta actualizada. — [Mindbody: Introducing Card Updater](https://www.mindbodyonline.com/business/education/infographic/introducing-card-updater) (infografías de 2021–2023, **antiguas**)

**Otros (referencia del patrón)**
- PerfectGym tiene notificaciones automáticas de pagos fallidos por email y SMS. El SMS tiene costo extra por mensaje. — [PerfectGym Help](https://help.perfectgym.com/hc/en-001/articles/39317253092625-Automation-Notifications-for-failed-payments)
- GymFlow envía un email automático al socio cuando su membresía queda vencida (con instrucciones de pago) y muestra una alerta dentro de la app. — [GymFlow: Manage failed payments](https://support.gymflow.io/en/articles/10146158-manage-failed-payments)
- GymOS reintenta cada noche los cobros con tarjeta, hasta 5 intentos. — [GymOS support](https://support.gymos.com/?p=819)
- En EE. UU. los SMS automatizados se rigen por la TCPA (consentimiento previo y opción de baja en cada mensaje). — [Fragmento de blog de proveedor citado en búsqueda](https://www.myaifrontdesk.com/use-cases/for/fitness/payment-reminder-outreach)

**Latinoamérica**
- Una cotización de sistema para gimnasios (Workana) pide: WhatsApp de próximo vencimiento 5 días antes, WhatsApp de servicio vencido y WhatsApp de "gracias por su pago". — [Workana: sistema gimnasios](https://www.workana.com/es/job/sistema-gimnasios)
- Klasius (México) anuncia reservas por WhatsApp, cobros por SPEI, OXXO y tarjeta, y un bot de IA. Su reseña en Capterra es de un solo usuario. — [Capterra: Klasius](https://www.capterra.in/software/1095059/Klasius)
- AgendaPro (MX) anuncia envío automático de recordatorios, seguimiento de pagos y vigencia de membresías, y cobro online o con terminal (TPV). — [AgendaPro MX](https://agendapro.com/mx/gimnasio/software-para-gimnasio)
- Proveedores de chatbots de WhatsApp para gimnasios promueven el recordatorio antes del vencimiento con link de pago en el chat, y el seguimiento después del vencimiento. Señalan que muchas membresías vencen porque el socio olvidó renovar. — [Cliengo: WhatsApp para gimnasios](https://guiawabusiness.cliengo.com/whatsapp-para-gimnasios); [Aurora Inbox](https://www.aurorainbox.com/2026/02/12/chatbot-gimnasios-whatsapp/) (marketing)
- Otras opciones listadas en México: iActiva GymAdmin, Smartgym, Gymcatch, Gym&i, PerfectGym, TIMP, Klasius. — [Comparasoftware MX](https://www.comparasoftware.com/software-para-gimnasios)

### Inferences
- Para un gimnasio mexicano sin cargo recurrente con tarjeta, el flujo de "reintentos" no aplica. Lo que sí aplica es una secuencia por fecha de vencimiento, por ejemplo: T-5 (o T-3) días aviso → T-0 "vence hoy" → T+1/T+3 "vencido" → confirmación al registrar el pago. Esto coincide con la cotización de Workana y con el patrón de dunning.
- Separar dos destinatarios: el socio (mensaje individual) y el staff/dueño (resumen agregado, al estilo del email nocturno de Wodify). El segundo es más barato y fácil de implementar (email) y puede ser la fase 1b, antes de mensajería al socio.
- El "link de pago" (Glofox) es clave para convertir el recordatorio en un cobro. En México podría ser un link de Mercado Pago, Stripe o una ficha OXXO/SPEI (no investigado aquí).

### Gaps
- No pude leer completas las páginas de Glofox, Wodify ni PushPress (403/404). Los tiempos exactos de los emails "upcoming charge" de PushPress y Wodify no se confirmaron.
- No encontré documentación oficial de Mindbody sobre los días antes o después del vencimiento en que se envía cada auto-email.
- No hay datos sobre si Klasius o AgendaPro usan la WhatsApp Business API oficial o integraciones no oficiales.

## 2. ¿Qué contiene normalmente un resumen diario o semanal para staff de pagos vencidos y próximos?

### Takeaway
No encontré un estándar de la industria. El ejemplo documentado más claro es el email nocturno de Wodify (facturas procesadas y fallidas con motivo de error). Lo demás (Gymdesk, GymFlow, GymOS) son dashboards o reportes en pantalla con: socio, monto, fecha de vencimiento, días de atraso, suscripciones detenidas y vencimientos próximos.

### Cited Findings
- Wodify: email nocturno al Billing Contact con el resumen del auto-billing, incluyendo facturas procesadas y fallidas con mensaje de error. — [Wodify Help](https://help.wodify.com/hc/en-us/articles/360011285453)
- Gymdesk (dashboard): socios con saldo, monto, fecha de vencimiento, los 5 pagos vencidos más recientes y suscripciones detenidas. — [Gymdesk Docs: Dashboard](https://docs.gymdesk.com/en/help/docs/dashboard)
- GymFlow: reporte en Reports > Members > Overdue Memberships (no se envía por email). — [GymFlow: Overdue Memberships](https://support.gymflow.io/en/articles/1407697-overdue-memberships)
- GymOS: widget "Overdue Membership Payments" con las cuotas no cobradas. — [GymOS support](https://support.gymos.com/?p=819)
- GymVibes: alertas automáticas a staff y socios sobre vencimientos próximos y pagos atrasados, por email y notificación en la app. — [GetApp: GymVibes](https://www.getapp.co.nz/software/2142875/gymvibes)
- GymMaster: reporte de deudas desde el que el staff envía seguimientos manuales por email. — [GymMaster: debt report](https://www.gymmaster.com/user-manual/manual_reference_reports_debt/); [GymMaster: failed payment reports](https://gymmaster.com/blog/failed-payment-reports)
- Glofox: "Failed Payment Report" y tareas para el staff dentro de los workflows. — [Glofox Support](https://support.glofox.com/hc/en-us/articles/46458001077780)

### Inferences
- Contenido propuesto para el digest diario del dueño (síntesis de lo anterior, no estándar):
  1. Encabezado con totales: número de socios vencidos y monto total vencido; vencen hoy; vencen en los próximos 7 días.
  2. Tabla de vencidos: nombre, teléfono, plan, monto, fecha de vencimiento, días de atraso, último recordatorio enviado.
  3. Tabla de próximos vencimientos (7 días).
  4. Pagos registrados ayer (ingresos del día).
  5. Membresías congeladas, canceladas o "detenidas" recientemente (como Gymdesk).
  6. Links o acciones rápidas (abrir perfil, mandar WhatsApp manual con wa.me).
- Para un gimnasio pequeño basta un digest diario temprano (antes de abrir). El semanal puede agregar tendencia (cobrado vs pendiente) y altas y bajas.
- Analogía: el digest es como el "corte de caja" impreso que muchos gimnasios mexicanos ya hacen a mano, pero enviado solo al correo o WhatsApp del dueño.

### Gaps
- No encontré ningún producto que documente un email diario al dueño que combine vencidos, próximos y cobrados (lo confirma la propia búsqueda). Tampoco hay datos de la industria (IHRSA/HFA, Club Industry) sobre el contenido recomendado.

## 3. Estado en 2026 de la WhatsApp Business Platform / Cloud API para pequeños negocios: precios, aprobación de plantillas, cambios de política y alternativas más simples

### Takeaway
Desde el 1-jul-2025 Meta cobra **por mensaje de plantilla entregado** (ya no por conversación), según categoría (marketing, utility, authentication) y país. El cambio más relevante para un sistema de recordatorios de gimnasio llegó el **1-oct-2026**: los mensajes utility dentro de la ventana de 24 h ya no son gratis, y los mensajes de servicio se cobran después de 1,000 por número al mes. Los recordatorios de pago (utility) en México cuestan del orden de USD $0.004–0.011 por mensaje, según la fuente (sin cifra oficial confirmada). La alternativa más simple y barata es el email (Resend: 3,000 al mes gratis). El SMS en México con Twilio es caro (~USD $0.15 por segmento).

### Cited Findings
**Modelo de precios (Meta, oficial)**
- Desde el 1-jul-2025: precio por mensaje, con la conversación como unidad de cobro deprecada. Solo se cobran los mensajes entregados de la empresa al usuario. Los mensajes del usuario son gratis. La tarifa depende de la categoría y del código de país del destinatario. — [Meta Developers: WhatsApp pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- Categorías de plantilla: marketing, utility, authentication. Las no-plantilla son service (y desde el 1-jul-2026 "Meta Business Agent"), y solo se pueden enviar dentro de la ventana de 24 h de atención. — [Meta Developers](https://developers.facebook.com/docs/whatsapp/pricing)
- 1-jul-2025: los mensajes utility enviados dentro de la ventana de atención pasaron a ser gratis. **1-oct-2026: vuelven a cobrarse** (el tipo de precio cambia de `free_customer_service` a `regular`). — [Meta Developers](https://developers.facebook.com/docs/whatsapp/pricing)
- 1-oct-2026: los mensajes service se cobran después de 1,000 gratis por número de teléfono al mes, a la tarifa utility/authentication del mercado. Hay 40 cambios de tarifa, entre ellos un **aumento de la tarifa de marketing en México**. — [Meta Developers](https://developers.facebook.com/docs/whatsapp/pricing); [DragApp (actualizado 21-oct-2026)](https://www.dragapp.com/blog/whatsapp-business-api-pricing/)
- Los descuentos por volumen aplican solo a utility y authentication, con reinicio mensual. Marketing no tiene descuento por volumen. — [Meta Developers](https://developers.facebook.com/docs/whatsapp/pricing); [DragApp](https://www.dragapp.com/blog/whatsapp-business-api-pricing/)
- Free Entry Point: si el usuario escribe desde un anuncio Click-to-WhatsApp, la respuesta no se cobra y se abre una ventana de hasta 7 días. — [Meta Developers](https://developers.facebook.com/docs/whatsapp/pricing)
- 1-ago-2026: los mensajes de Meta Business Agent se cobran a USD $2.00 por millón de tokens. — [DragApp](https://www.dragapp.com/blog/whatsapp-business-api-pricing/)
- Meta clasifica cada plantilla al aprobarla en marketing, utility o authentication. Utility es un seguimiento transaccional ligado a una acción del cliente. Marketing incluye promociones y reactivación, y es la categoría más cara. — [DragApp](https://www.dragapp.com/blog/whatsapp-business-api-pricing/)

**Tarifas México (no oficiales, en conflicto)**
- Marketing: ~USD $0.0436 por mensaje (antes del aumento del 1-oct-2026; la nueva cifra no aparece en las fuentes). — [ChatDaddy](https://www.chatdaddy.tech/blog/whatsapp-business-api-pricing); [Getkanal](https://getkanal.com/blog/whatsapp-business-pricing-guide)
- Utility: $0.0108 según [ChatDaddy](https://chatdaddy.tech/blog/whatsapp-api-pricing); $0.0080 según [Aurora Inbox](https://www.aurorainbox.com/en/precio-whatsapp-business-api-mexico-2026/); $0.0040 según [MessageCentral](https://www.messagecentral.com/blog/whatsapp-business-api-pricing-2026). **Las fuentes se contradicen.** La cifra oficial está en los rate cards CSV/PDF de Meta, que no pude leer.
- Authentication: $0.0309 según Aurora Inbox y $0.0250 según ChatDaddy. — mismas fuentes.
- Los proveedores (BSP) pueden sumar su comisión a la tarifa de Meta. — [Activepieces](https://www.activepieces.com/blog/whatsapp-pricing-2026-per-message-rates-by-country); [Spur](https://www.spurnow.com/en/blogs/whatsapp-business-api-pricing-explained)

**Cambios de política**
- Desde el 15-ene-2026 Meta prohíbe en la Business API los chatbots de IA de propósito general (asistentes abiertos tipo ChatGPT). Siguen permitidos los bots de soporte, ventas, reservas, notificaciones y FAQs. — [respond.io](https://respond.io/blog/whatsapp-general-purpose-chatbots-ban); [Business Standard](https://www.business-standard.com/technology/tech-news/meta-bans-ai-chatbots-from-whatsapp-business-api-chatgpt-to-shut-down-jan-2026-125102200335_1.html)

**Alternativas**
- Resend (email): plan gratis de 3,000 emails al mes con tope de 100 al día y 1 dominio. Pro cuesta USD $20 al mes por 50,000 emails. Hay reportes de reestructura de precios. — [Resend pricing](https://resend.com/pricing.md); [toolradar](https://toolradar.com/tools/resend/pricing); [Nuntly](https://nuntly.com/resend-pricing)
- Twilio SMS México: USD $0.1511 por segmento saliente (long code) y $0.0200 entrante, más una cuota de $0.001 por mensaje fallido. Una página de Twilio de 2023 daba $0.0515 (**antigua**). — [Twilio SMS pricing MX](https://twilio.com/en-us/sms/pricing/mx); [Twilio 2023](https://support.twilio.com/hc/en-us/articles/15901481485595-International-SMS-pricing-change-launching-June-1-2023)

### Inferences
- Costo estimado: 150 socios × 3 recordatorios al mes ≈ 450 mensajes utility. Entre USD $0.004 y $0.011 por mensaje, eso da ~USD $2–5 al mes en tarifas de Meta, más la comisión del BSP si se usa uno. Es barato comparado con SMS: 450 × $0.15 ≈ $68 al mes.
- El recordatorio de pago debería registrarse como plantilla **utility** (transaccional), no marketing. Si Meta la reclasifica como marketing, el costo sube ~4–10×. Conviene redactarla sin tono promocional (sin "¡aprovecha!" ni descuentos).
- La complejidad real de WhatsApp no es el precio sino la configuración: cuenta de Meta Business, verificación, número dedicado, aprobación de plantillas y webhooks. Para un junior y un MVP, una ruta escalonada tiene sentido:
  - fase 1b: digest al dueño por email (Resend) + botón "abrir WhatsApp" (`wa.me/<num>?text=...`, envío manual desde el teléfono del gimnasio, sin API);
  - fase 2: WhatsApp Cloud API con plantillas utility automáticas.
- Analogía: la API oficial es como abrir una cuenta empresarial en el banco (trámites, pero formal y escalable). El link wa.me es como mandar el mensaje tú mismo desde tu celular: gratis e inmediato, pero manual.
- Telegram Bot API sería una alternativa gratuita para notificar **al dueño o al staff** (no a socios, que en México casi no usan Telegram), pero no lo investigué con fuentes en esta ronda.

### Gaps
- Tarifa oficial vigente (post 1-oct-2026) de utility y marketing para México: requiere descargar el rate card de Meta.
- Tiempos de aprobación de plantillas y límites de mensajería por nivel (tiers de 250/1K/10K) en 2026: no encontré fuentes en esta ronda.
- Límites de frecuencia de marketing por usuario (el "per-user marketing message limit") en 2026: no confirmado.
- Telegram Bot API (costo y límites) y otros proveedores de email (SendGrid, Brevo, Amazon SES): sin fuentes recogidas.
- No investigué el uso de librerías no oficiales (tipo whatsapp-web.js) ni su riesgo de bloqueo.

## 4. ¿Cómo controlan los gimnasios su equipo e inventario? Campos por máquina, bitácoras de mantenimiento y si algún producto específico para gimnasios lo ofrece

### Takeaway
Ni Gymdesk, Glofox, PushPress, Mindbody ni Wodify aparecen ofreciendo inventario de máquinas. Esto lo cubren CMMS genéricos o especializados (UpKeep, Maintainly, BlueFolder, FitnessEMS, Fitness Mechanics, GymGear Service Portal). El registro estándar tiene una ficha por máquina (fabricante, modelo, número de serie, fecha de compra, garantía, ubicación, estado), una bitácora de servicios ligada a la máquina, mantenimiento preventivo programado y reportes de falla, a menudo con código QR pegado al equipo.

### Cited Findings
- Campos típicos por activo: fabricante, modelo, número de serie, fecha de compra, estado de la garantía, ubicación y condición. — [FitnessEMS: 2026 comparison guide](https://fitnessems.com/best-equipment-tracking-systems-for-gyms-a-2026-comparison-guide/) (blog de proveedor)
- Versión hoja de cálculo: nombre del equipo, número de serie, fecha de compra, fecha del último servicio y notas. — [FitnessEMS](https://fitnessems.com/best-equipment-tracking-systems-for-gyms-a-2026-comparison-guide/); [Expansive FM](https://www.expansivefm.com/latest/5-proven-gym-equipment-management-tips-to-reduce-downtime-in-fitness-facilities)
- ServiceSport/simPRO pegan una etiqueta con número único de activo a cada máquina y registran contra ella cada servicio, revisión o reparación. — [ServiceSport: Asset Management](https://www.servicesport.com/assetmanagement/)
- Maintainly y Fitness Mechanics usan códigos QR para que el staff o los socios escaneen la máquina y vean su ficha o reporten una falla. — [Maintainly: gyms CMMS](https://maintainly.com/gyms-sports-facilities-cmms); [Fitness Mechanics software](https://fitnessmechanics.ca/software.php)
- UpKeep: acceso al número de serie y seguimiento de reclamos de garantía. El mantenimiento rutinario evita anular garantías. — [UpKeep: gym maintenance](https://upkeep.com/maintenance-software-for/gym-fitness-maintenance/)
- BlueFolder: mantenimiento preventivo, solicitudes de servicio, órdenes de trabajo e inspecciones programadas. — [BlueFolder](https://bluefolder.com/industries/fitness-equipment-maintenance-software/)
- GymGear (fabricante) ofrece un portal de servicio para registrar activos y su historial de mantenimiento. — [GymGear Service Portal](https://gymgear.com/pages/service-portal)
- Otras opciones: [OpenWrench: 8 best facilities software for gyms 2026](https://useopenwrench.com/blog/best-facilities-management-software-for-gyms), [FieldCircle](https://www.fieldcircle.com/software/cmms/gym-maintenance/), [GoCodes](https://gocodes.com/use-an-app-to-automate-service-requests-for-your-gym-or-health-club)

### Inferences
- Modelo de datos sugerido (síntesis):
  - `equipo`: id, nombre, categoría (cardio, fuerza, peso libre, accesorio), marca, modelo, número de serie, fecha de compra, costo, proveedor, garantía hasta, ubicación o zona, estado (operativo / en reparación / fuera de servicio / dado de baja), foto, código QR, frecuencia de mantenimiento preventivo en días.
  - `mantenimiento`: id, equipo_id, fecha, tipo (preventivo / correctivo / inspección), descripción, costo, técnico o proveedor, próximo servicio.
  - `reporte_falla` (opcional): equipo_id, reportado por, fecha, descripción, estado (abierto / resuelto).
- Para un gimnasio de una sede, la fase 3 o 4 puede ser solo un CRUD de equipo + bitácora + alerta "mantenimiento vencido" incluida en el digest del dueño. Así se reutiliza la infraestructura de notificaciones de las fases 1b/2.
- Accesorios consumibles (toallas, productos de limpieza, suplementos a la venta) son "inventario de productos", un concepto distinto de los "activos". Conviene separarlos.

### Gaps
- No encontré documentación de Gymdesk, Glofox, PushPress, Mindbody o Wodify sobre inventario de máquinas (parece que no lo ofrecen; no está confirmado).
- No hay datos de la industria (HFA/IHRSA) sobre frecuencias recomendadas de mantenimiento por tipo de máquina. Normalmente las define el manual del fabricante.
- No revisé proyectos open-source de GitHub para este módulo.

## 5. ¿Cómo registran los gimnasios o el software el progreso de los socios? Entrevista inicial y metas, medidas corporales, evaluaciones y planes de entrenamiento: campos y frecuencia

### Takeaway
El flujo típico es: intake al inicio (PAR-Q/PAR-Q+ de salud, historial, nivel de actividad, metas, preferencias, contacto de emergencia) → evaluación base (peso, % grasa, circunferencias, talla/IMC, fotos, pruebas físicas) → reevaluaciones periódicas con los mismos campos. El software (GymMaster, Gymkee, Gym Assistant) permite configurar qué métricas medir. Gym Assistant sugiere medición mensual y avisa al socio en el check-in cuando le toca.

### Cited Findings
- PAR-Q: se aplica antes de la primera sesión, durante el intake. Cualquier "sí" requiere autorización médica antes de entrenar. NASM lo llama la primera decisión profesional del entrenador. — [NASM: PAR-Q](https://www.nasm.org/resource-center/blog/fitness/everything-you-need-to-know-about-the-par-q); [Marathon Handbook: PAR-Q](https://marathonhandbook.com/par-q/)
- El PAR-Q se revisa periódicamente, sobre todo tras cambios importantes de salud (sin plazo fijo). — [Marathon Handbook](https://marathonhandbook.com/par-q/)
- El intake recoge historial de salud, nivel de actividad actual, metas, preferencias y contacto de emergencia. — [Pabau: Personal trainer intake form](https://pabau.com/templates/personal-trainer-intake-form/); [NFPT: client intake sessions](https://nfpt.com/fitness-assessments-how-to-do-client-intake-sessions/)
- El formulario de evaluación registra las medidas base que se volverán a medir. Repetirlas según calendario es lo que hace útil el programa. — [Pabau: trainer assessment](https://pabau.com/templates/personal-trainer-assessment/); [Formswrite](https://formswrite.com/templates/fitness-assessment-intake-form)
- GymMaster: se configuran las unidades y las métricas corporales a medir. Los entrenadores registran medidas por socio en "Manage Training" y el progreso se ve en el perfil. — [GymMaster: measurements](https://www.gymmaster.com/user-manual/manual_measurements/); [GymMaster: trainers measurements](https://www.gymmaster.com/user-manual/manual_members_trainers_measurements)
- Gymkee: evaluaciones personalizables con medidas (peso, circunferencias, métricas propias), preguntas de feedback (texto abierto, calificación 1–10, sí/no) y fotos de progreso (frente, espalda, perfil). — [Gymkee: assessments](https://gymkee.com/coach/client-management/assessments/)
- Gym Assistant registra medidas básicas mensualmente y avisa en el check-in cuando le toca medición al socio. — [Gym Assistant: Measurement settings](https://www.gymassistant.com/online_help/gym_assistant/measurementsettings.html)
- Otros: altura, peso, tallas e IMC ([GetApp: gym management system](https://www.getapp.co.uk/software/2064619/gym-management-system)); máximos y récords personales y fotos ([FitHive Retain](https://myfithive.com/fithive-retain)); fotos de progreso ([Exercise.com](https://exercise.com/platform/progress-photos)).
- Ejemplo open-source (proyecto académico) con evaluaciones de socios: [GitHub sarahbarron/WIT Gym App](https://github.com/sarahbarron/WIT-Web-Development-Assignment-2-Gym-App)

### Inferences
- Modelo de datos sugerido (síntesis):
  - `entrevista_inicial` (1 por socio, editable): PAR-Q (7 preguntas sí/no + observaciones), padecimientos/lesiones, medicamentos, nivel de actividad, objetivo principal (bajar grasa / ganar músculo / salud / rendimiento), meta medible y fecha meta, disponibilidad (días por semana), contacto de emergencia, consentimiento.
  - `medicion` (muchas por socio): fecha, quién midió, peso, estatura, % grasa (y método: báscula de bioimpedancia, plicómetro), masa muscular, circunferencias (cintura, cadera, pecho, brazo, muslo), IMC calculado, fotos opcionales, notas.
  - `evaluacion_fisica` (opcional): pruebas (sentadillas en 1 min, lagartijas, plancha, 1RM estimado), valor y unidad.
  - `plan_entrenamiento`: socio, entrenador, fecha inicio y fin, objetivo, rutina (días → ejercicios con series, repeticiones y carga).
- Frecuencia: la única fuente con frecuencia explícita es Gym Assistant (mensual). Una reevaluación cada 4–8 semanas es convención común, pero **no la verifiqué** (ver Gaps). Un recordatorio "le toca medición" puede reutilizar el motor de notificaciones.
- Para planificar fases: el progreso (fase 3) tiene más valor de retención para el socio que el inventario (fase 4), que es valor operativo para el dueño. Es una inferencia, sin dato de soporte.

### Gaps
- No encontré guía de ACSM/NSCA ni datos de la industria sobre la frecuencia recomendada de reevaluación (la búsqueda no lo confirmó).
- No obtuve la documentación de Trainerize ni de Virtuagym sobre sus campos de progreso.
- No encontré estadísticas que vinculen el seguimiento de progreso con la retención de socios.
