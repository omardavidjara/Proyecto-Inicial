# Hoja de ruta

Plan del proyecto. Claude la lee al inicio de cada sesión y marca las casillas al terminar cada tarea.

Etiquetas: **[C]** lo hace Claude solo · **[T]** requiere al usuario (cuentas, claves, revisión) · **[J]** Claude propone o pregunta, el usuario aprueba.
🛑 = punto de control: Claude se detiene y espera el OK del usuario.

## Protocolo de sesión (Claude)

1. Leer esta hoja. La fase activa es la primera con casillas abiertas.
2. Hacer seguidas las tareas [C] de la fase activa, en orden. Por cada tarea: implementar → `npm run check` → commit → marcar `[x]` aquí.
3. Parar en la primera tarea [T], [J] o 🛑: decir al usuario exactamente qué necesita hacer o decidir.
4. No empezar una fase hasta cerrar todas las casillas de la anterior.
5. Al cerrar una fase: hacer push y recomendar `/clear`. Desde la Fase 4, `main` está protegida: todo cambio va por rama y PR, y la fusiona el usuario con la CI en verde.
6. Nunca: subir secretos, exponer `DATABASE_URL` o claves de servidor al cliente, fusionar en `main` con la CI en rojo o tocar la base de datos de producción sin migración.

Límites de los planes gratuitos (Vercel Hobby, Neon Free, GitHub, Sentry) y sus alternativas: `docs/LIMITS.md`. Revisarlo antes de cada plan de tarea.

Arquitectura de datos: **todo en Neon**. Postgres para los datos (con Drizzle ORM, accedido solo desde el servidor) y **Neon Auth** para la autenticación (los usuarios viven en el esquema `neon_auth` de la misma base de datos). No se usa Supabase.

## Fase 0 · Cimientos ✅
- [x] [T] Instalar Node.js, Git, VS Code y Claude Code
- [x] [T] Cuentas en GitHub y Vercel
- [x] [C] Proyecto Next.js + TypeScript + Tailwind
- [x] [C] Repositorio en GitHub con todo el proyecto subido
- [x] [C] CLAUDE.md con reglas y protocolo
- [x] [C] Vitest; `npm run check` = lint + tipos + tests
- [x] [C] docs/ROADMAP.md

## Fase 1 · Especificación y arquitectura ✅
- [x] [J] Entrevista al usuario → `docs/SPEC.md` (qué hace, usuarios, pantallas, datos)
- [x] [J] Qué necesita el móvil: notificaciones, cámara, uso sin conexión… (define el alcance de la Fase 8)
- [x] [C] `docs/ARCHITECTURE.md`: tablas en Neon, relaciones, rutas, permisos y cómo se enlazan los usuarios de Neon Auth (`user_id`) con los datos
- [x] [C] Índices, paginación y reparto servidor/cliente
- [x] 🛑 [T] Revisar y corregir SPEC y ARCHITECTURE

## Fase 2 · Sistema de diseño y PWA ✅
Revisión de cierre: `docs/reviews/FASE-2.md` (pendientes heredados por otras fases).
- [x] [C] `docs/DESIGN.md`: colores, tipografía, espaciados, estados de carga, vacío y error
- [x] [C] shadcn/ui + botón, campo, tarjeta, diálogo, tabla
- [x] [C] Diseño pensado primero para móvil: zonas táctiles de 44px o más, navegación inferior, safe areas
- [x] [C] PWA: manifest, iconos, service worker básico y página sin conexión
- [x] [C] Prototipo de las 2 o 3 pantallas clave
- [x] 🛑 [T] Revisar el prototipo (también en un móvil)
- [x] [C] Contraste, foco de teclado y comportamiento en móvil

## Fase 3 · Datos y seguridad base ✅
Revisión de cierre: `docs/reviews/FASE-3.md` (pendientes heredados por otras fases).
- [x] [T] Crear la cuenta y el proyecto en Neon (región AWS Frankfurt, `aws-eu-central-1`; autoescalado 0,25–1 CU, ver LIMITS D3) y dar a Claude `DATABASE_URL` (con pooling) y `DATABASE_URL_UNPOOLED` (directa, para migraciones) para `.env.local`
- [x] [T] Activar Neon Auth en el proyecto (pestaña Auth de la consola), elegir los métodos de login, configurar las URL de redirección y dar a Claude sus claves
- [x] [T] Poner en marcha la copia diaria: claves de age, *bucket* de R2 y secretos de GitHub (`docs/BACKUPS.md`), y probar una restauración (hecho 2026-10-07)
- [x] [T] Conectar el repositorio a Vercel, añadir la integración de Neon (una rama de base de datos por cada preview) y copiar las variables de entorno (hecho 2026-10-07: https://athlosapp.vercel.app, login con Google probado)
- [x] [J] Tareas programadas (decidido 2026-10-05: cron-job.org solo en horario del gimnasio + GitHub Actions de respaldo; se implementa en F3 y F10): Vercel Hobby solo permite cron diario; confirmar la alternativa propuesta (programador externo en horario del gimnasio + ruta idempotente, LIMITS D2) o Vercel Pro
- [x] [J] Copias de seguridad (decidido 2026-10-05: Cloudflare R2 con jurisdicción UE, cifrado con age; `.github/workflows/db-backup.yml`): Neon Free solo guarda 6 h de historial; decidir dónde guardar el `pg_dump` diario cifrado (LIMITS D5)
- [x] [C] `vercel.json` con región `fra1`, *Ignored Build Step* para cambios solo de documentación y borrado de ramas de Neon al cerrar PR (LIMITS D3, D4, D6)
- [x] [C] Drizzle ORM + driver serverless de Neon; esquema en `db/schema.ts` y migraciones en `drizzle/` generadas con drizzle-kit (nunca a mano en la consola de Neon). Probadas con PGlite y aplicadas en Neon (2026-10-04)
- [x] [C] Login con Neon Auth (SDK oficial, sesión en cookies); tabla `profiles` con el mismo `user_id` que `neon_auth.user`, creada en el primer inicio de sesión (sin FK hacia `neon_auth`, ver ARCHITECTURE §2)
- [x] [C] Proteger las rutas: `(client)`, `admin/` y `entrenador/` exigen sesión y rol (hoy, prototipo, se abren sin login; `/login`, `/registro`, `/privacidad`, `/aviso-legal` y `/offline` siguen públicas); `/` deja de ser el índice del prototipo y redirige a `/login` o al inicio de cada rol (ARCHITECTURE §5)
- [x] [C] Capa de datos solo en servidor: cada consulta filtra por el `user_id` de la sesión verificada; validar toda entrada con Zod
- [x] [C] Test con dos usuarios: ninguno ve los datos del otro

## Fase 4 · Auto-auditoría automatizada ✅
Revisión de cierre: `docs/reviews/FASE-4.md` (pendientes heredados por otras fases).
- [x] [C] `.github/workflows/ci.yml`: lint, tipos, tests, migraciones coherentes con `db/schema.ts`, build y `npm audit --omit=dev --audit-level=high` bloqueante (el completo solo como aviso). Los 4 avisos moderados de `esbuild` dentro de `drizzle-kit` (vía `better-auth`) quedan fuera por gravedad; anotado en el workflow. Al crearla, `npm audit fix` subió `sharp` (0.35.5) y `source-map-js` (1.2.2), con avisos altos nuevos en producción
- [x] [C] Hooks de Claude Code: `npm run check` tras cada edición de código (`.claude/settings.json` → `scripts/claude-check.mjs`; en segundo plano con `asyncRewake`, solo avisa si falla; no lanza comprobaciones en paralelo)
- [x] [C] `.github/dependabot.yml`: npm y GitHub Actions cada lunes; menores y parches en una sola PR, mayores sueltas, `@neondatabase/auth` (beta) en PR propia; tope de 4 PR abiertas por las ramas de Neon (LIMITS D4)
- [x] [J] Sentry: el usuario crea la cuenta y da el DSN; Claude lo integra. Hecho 2026-10-07: región UE, `lib/sentry.ts`, `instrumentation*.ts`, `app/global-error.tsx`, `/privacidad` al día, `NEXT_PUBLIC_SENTRY_DSN` solo en Production de Vercel; error de prueba recibido desde `/api/sentry-test` (solo rol developer). Pendiente opcional: `SENTRY_AUTH_TOKEN` para subir source maps
- [x] [T] Protección de rama en `main` (Settings → Branches), exigiendo la CI (hecho 2026-10-07: solo por PR, «Comprobaciones» y «Dependencias» obligatorias para todos)

Auditoría intermedia (2026-10-08, antes de empezar la Fase 5): `docs/reviews/AUDITORIA-2026-10-08.md` (corregido y pendientes).

Auditoría rápida (2026-10-12, F1 terminada): `docs/reviews/AUDITORIA-2026-10-12.md` (sin críticos; pendientes repartidos abajo).

Auditoría rápida (2026-10-14, F6 terminada, antes de F7): `docs/reviews/AUDITORIA-2026-10-14.md` (sin críticos; un fallo medio y pendientes repartidos abajo).

## Fase 5 · Funcionalidades (una por sesión, en el orden de SPEC)
Ciclo: rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → [T] el usuario fusiona.
Cada funcionalidad sustituye su parte del prototipo de la Fase 2: datos de `lib/prototype/` por consultas reales, páginas "Próximamente" (`components/coming-soon.tsx`) por las pantallas reales y la franja `PrototypeNotice`. Cuando no quede nada, borrar `lib/prototype/` y esos dos componentes (`lib/prototype/` y `PrototypeNotice` borrados en F7 PR 2).
- [x] F1 · Registro, alta pendiente/aprobación, perfil con foto y bajas (el formulario de registro muestra `PrivacySummary` antes de enviar; perfil con enlaces legales y "Eliminar mi cuenta"). Pendiente de la Fase 3: el endpoint `delete-user` de Neon Auth está desactivado (404): activarlo en la consola o usar la API de administración de Neon para borrar la cuenta; las cuentas `pending` deben poder abrir `/perfil` (hoy solo `/pendiente`, ARCHITECTURE §6). Plan aprobado el 2026-10-11 en 5 PR: (1) registro ✅ — correo + código de 6 cifras, registro reactivado en Neon con verificación obligatoria (ARCHITECTURE §6); (2) perfil editable ✅ — nombre y teléfono, también para pendientes y bajas; `/pendiente` pide el teléfono a quien entra con Google; (3) altas y bajas en `/admin/clientes` ✅ — pestañas pendientes/activos/baja, aprobar, rechazar, dar de baja (anula reservas futuras en una transacción) y reactivar; «Altas pendientes» real en «Hoy». Promover la lista de espera al liberar plazas: hecho en F5; para F4: asignar tarifa al aprobar; (4) foto en Vercel Blob ✅ — almacén «athlos-fotos» en fra1, público con nombre aleatorio, conectado a Production y Preview con `BLOB_READ_WRITE_TOKEN`; reducida en el navegador (512 px WebP, < 300 KB) y subida directa con token firmado solo para la carpeta propia; la anterior se borra al cambiarla o quitarla; (5) eliminar mi cuenta ✅ — confirmación escribiendo ELIMINAR; anonimiza el perfil, anula reservas futuras y dispositivos, borra la foto y el usuario de Neon Auth con una clave de organización limitada al proyecto («athlos-eliminar-cuentas»), solo en Production de Vercel (las previews comparten ids de usuario: no deben borrar). Terminada el 2026-10-11. Pendiente para la Fase 7: el correo del código llega en inglés y desde `auth@mail.myneon.app` (servidor compartido de Neon); con dominio propio, configurar un servidor de correo propio (permitiría también el enlace en vez del código)
- [x] Acceso a «Mi perfil» para administradores (detectado el 2026-10-12, hecho con F2): `/admin/perfil` con la navegación de administración, enlazado desde «Más»
- [x] F2 · Tipos de clase (grupal / individual, aforo, color). `/admin/tipos-clase`: crear, editar, activar/desactivar y eliminar (solo si no se ha usado nunca; si no, desactivar). La base de datos exige color de la paleta, individual = aforo 1 y nombre único sin distinguir mayúsculas (migración 0004). «Más» deja de ser «Próximamente»: menú real con las opciones que faltan marcadas. Terminada el 2026-10-13
- [x] F3 · Horario: plantilla semanal, generación de sesiones y sesiones sueltas/cancelación. Plan aprobado el 2026-10-13 en 2 PR: (1) plantilla semanal en `/admin/horario` y generación (al guardar y con el cron diario de Vercel `api/cron/generate-sessions`, `CRON_SECRET` solo en Production) ✅; (2) pestaña «Próximas sesiones» ✅: sesiones sueltas, mover, cambiar entrenador/aforo (`is_customized`, el aforo no baja de las confirmadas) y cancelar (definitivo, con motivo) anulando reservas. Terminada el 2026-10-13. Promover la lista de espera al subir el aforo: hecho en F5. Pendiente para F10: avisar por push a los afectados por una cancelación (hoy el diálogo pide avisarles a mano)
- [x] F4 · Tarifas y asignación a clientes. Plan aprobado el 2026-10-13 en 2 PR: (1) catálogo en `/admin/tarifas` (crear, editar con aviso de cuántos clientes la tienen, activar/desactivar y eliminar solo si nunca se asignó; nombre único sin distinguir mayúsculas, migración 0005) ✅; (2) asignación: tarifa **opcional** al aprobar un alta, «Cambiar tarifa» con fecha de inicio e historial, cerrar la vigente al dar de baja, y tarifa real con clases restantes en la vista del cliente ✅ (`lib/data/memberships.ts`: `assignPlan`, `endMembershipsFrom` y `countUsedClasses`, que F5 usará al reservar; «Inicio» y «Calendario» ya muestran la tarifa real, el resto sigue siendo prototipo). Terminada el 2026-10-13. Pendiente para F8: tarifa e historial en la ficha del cliente
- [x] F5 · Calendario y reservas del cliente (reservar, modificar, anular, lista de espera). Plan aprobado el 2026-10-13 en 3 PR: (1) reglas y transacciones (`lib/booking.ts`, `lib/data/bookings.ts`: reservar, anular, cambiar y promover la lista de espera, también al subir el aforo, dar de baja y eliminar la cuenta) ✅; (2) calendario y detalle de sesión del cliente con datos reales ✅ (`lib/data/calendar.ts`, acciones en `app/(client)/calendario/actions.ts`; los días van de hoy a la ventana de reserva; cambiar de sesión = «Cambiar a otra sesión» → el calendario con `?cambiar=<reserva>` → «Cambiar a esta sesión»); (3) «Mis reservas» ✅ (`lib/data/my-bookings.ts`: próximas agrupadas por día; historial de clases empezadas y anulaciones con «Ver más» por cursor `(inicio, id)`; tarifa y clases restantes) y «Inicio» con nombre y próxima clase confirmada reales. Las pantallas del cliente ya no usan `lib/prototype`. Terminada el 2026-10-13. Pendiente para F10: «Últimos avisos» en «Inicio» y el punto de no leídos de la campana (quitados del prototipo)
- [x] F6 · Agenda del administrador (día / semana / mes) y anulaciones tardías. Plan aprobado el 2026-10-14 en 3 PR: (1) ✅ #37 anulaciones tardías (`lib/data/agenda.ts`: pendientes de la más antigua a la más reciente, «Descontar» / «No descontar» con quién decidió; `/admin/anulaciones`, enlazada desde «Hoy» y «Más») y «Hoy» con datos reales; (2) ✅ #39 agenda `/admin/agenda?vista=dia|semana|mes&fecha=` con ocupación y lista de espera; (3) ✅ detalle `/admin/sesiones/[id]`: asistentes, lista de espera, anulaciones tardías, añadir o quitar un cliente a mano y asistencia. Al añadir a mano se salta todo: cupo de la tarifa, ventana de reserva y aforo (puede quedar 13/12), también en sesiones pasadas para registrar la asistencia. Quitar nunca descuenta; la asistencia se marca desde que empieza la sesión, con resumen «Asistieron · Faltaron · Sin marcar». Terminada el 2026-10-14
- [x] Arreglo antes de F7: una falta («Faltó») sigue gastando clase después de quitar al cliente de la sesión (`countUsedClasses` cuenta `no_show` sin mirar el estado; `removeBookingFromSession` no reinicia la asistencia). Quitar nunca descuenta: corregir con test. AUDITORIA-2026-10-14 #1. Hecho el 2026-10-14 en `fix/no-show-after-removal`: solo cuentan `confirmed` (con o sin falta) y tardías descontadas; al quitar, la asistencia vuelve a pendiente
- [x] F7 · Entrenadores: mis clases, asistentes y asistencia. Plan aprobado el 2026-10-15 en 3 PR: (1) «Mi semana» y el día con datos reales, solo las sesiones con `coach_id` = el entrenador (`listCoachSessionsBetween`) ✅; (2) detalle de sesión del entrenador con asistencia y resumen, y `db:set-role … admin --coach` para marcar como entrenador a un administrador ✅ (`getSessionDetail`/`setAttendance` con `coachId`; el entrenador no añade ni quita clientes ni ve las anulaciones tardías; borrado `lib/prototype/`); (3) sesión individual (aforo 1) con un cliente: se salta ventana y aforo pero sí descuenta de la tarifa ✅ (`lib/data/individual-sessions.ts`, botón «Sesión individual» en «Mi semana»; si el cliente no tiene tarifa o clases libres no se crea, y administración puede apuntarlo a mano; cancelar o mover sigue en Horario); (4) clases impartidas del entrenador: Semana | Mes, resumen «Impartidas · Programadas · Canceladas» y tabla de las ya dadas con asistentes ✅ (`lib/coach-summary.ts`, `getCoachPeriod` con `?vista=mes&fecha=`; el mes reutiliza `AgendaMonth` con `dayHref`; las sesiones de la agenda traen `attended`; una clase en curso cuenta como programada); (5) «Entrenadores» en administración: tabla por entrenador y periodo, y su calendario (añadidas el 2026-10-15 a petición del usuario; solo consulta, sin horas ni importes) ✅ (`/admin/entrenadores` en Más y `/admin/entrenadores/[coachId]`; `getCoachesOverview` hace una sola consulta del periodo y agrupa con `summarizeCoaches`; el calendario es `components/coach/coach-calendar.tsx`, compartido con «Mi semana»; solo salen los entrenadores activos: uno desactivado deja de verse aunque diera clases en el periodo). «Abrir incidencias» pasa a F9.
- [x] F8 · Gestión de clientes (lista, ficha, filtros). Plan aprobado el 2026-10-16 en 2 PR (altas, bajas, reactivar y tarifa ya existen desde F1/F4): (1) lista con búsqueda por nombre (`?q=`, conserva la pestaña), recuento en cada pestaña y «Ver más» de 50 en 50 (`?limite=`, máximo 500) ✅ (`listClients` con `{ query, limit }` y `countClientsByStatus`); (2) ficha `/admin/clientes/[userId]`: datos y correo, tarifa vigente con clases restantes e historial, acciones, próximas reservas, historial con asistencia, resumen de 30 días e incidencias «llegan con F9»; cada cliente de la lista enlaza a su ficha ✅ (PR #51: `getClient`, `getAuthEmail` desde `neon_auth.user` y `summarizeClientActivity`; `BookingHistory` admite otra acción y ruta). Terminada el 2026-10-16. Pendiente para F9: incidencias en la ficha
- [x] F9 · Incidencias. Plan aprobado el 2026-10-16 en 2 PR (la tabla `incidents` ya existe: sin migración; `assigned_to` se queda sin usar porque el SPEC no lo pide): (1) administración: lista por estado (Abiertas · En curso · Cerradas, `?estado=`, recuentos y «Ver más» de 20 en 20 con `?limite=`), «Nueva incidencia» (título, descripción, prioridad y cliente opcional con buscador, recordando no escribir datos de salud), detalle `/admin/incidencias/[incidentId]` con editar y cambiar de estado (abierta → en curso → cerrada y reabrir; `closed_at` al cerrar), e incidencias en la ficha del cliente con «Nueva incidencia» ya asociada ✅ (`lib/data/incidents.ts`, `lib/validation/incidents.ts`; el buscador de clientes pasa a `components/client-search.tsx`, compartido con la sesión individual); (2) entrenador: «Incidencias» con las que ha abierto y crear nuevas, asociadas solo a sus sesiones o a los clientes apuntados a ellas, sin cambiar el estado (`createdBy` en la capa de datos); e incidencias de la sesión en su detalle (administración y entrenador) ✅ (PR 1 #52; PR 2: `createIncident` con `coachId`, `listSessionIncidents`, detalle de solo lectura `/entrenador/incidencias/[incidentId]`; el entrenador elige el cliente entre los apuntados a la sesión y el estado lo lleva administración). Terminada el 2026-10-16. Pendiente: «asignada a» (`assigned_to`) sin usar; el entrenador no edita sus incidencias
- [ ] F10 · Avisos y notificaciones push. Push **web** (Web Push con el service worker de la PWA, sin plugins nativos; decidido el 2026-10-15 al aparcar las tiendas): en Android funciona en el navegador o instalada; en iPhone (iOS 16.4+) solo con la app añadida a la pantalla de inicio, así que pedir el permiso desde la app instalada y explicarlo en «Instalar la app»
- [x] [C] Pantalla «Instalar la app» (decidido el 2026-10-15): pasos para Android (botón «Instalar» con `beforeinstallprompt` cuando el navegador lo ofrezca) y para iPhone (Safari → Compartir → «Añadir a pantalla de inicio»); enlazada desde «Inicio» o «Perfil» y oculta si ya se abre instalada (`display-mode: standalone`). Hecha el 2026-10-16 (PR #54): `/instalar` pública (se puede enviar el enlace a quien aún no tiene cuenta), enlace en «Inicio» y en «Perfil» (cliente y entrenador), detección en `lib/install.ts` (iPhone con Safari, iPhone con otro navegador, Android, resto). Pendiente para F10: pedir el permiso de push desde la app instalada y, en iPhone sin instalar, enlazar a `/instalar`
- [ ] Mejoras de diseño (pedidas el 2026-10-16, plan aprobado en 3 PR): (1) cabecera de marca con logo y «Athlos» en todas las pantallas, que lleva al inicio de cada rol; el título pasa al contenido ✅ (`feat/brand-header`); (2) estética más animada pero amigable: tokens de degradado y sombra, micro-animaciones con propósito y `prefers-reduced-motion`; reescribir el principio 4 de `docs/DESIGN.md` (`feat/livelier-look`); (3) calendario del cliente con vistas Día · Semana · Mes reutilizando `lib/agenda.ts`; el mes muestra todas las sesiones generadas y las que quedan fuera de la ventana de reserva llevan «Se abre el …» sin botón de reservar (opción a, elegida el 2026-10-16) (`feat/client-calendar-views`)
- [ ] F11 · Equipo: roles y ajustes del gimnasio (solo desarrollador)
- [ ] [J] Entrenador sustituto en una clase ya empezada: hoy Horario solo deja cambiar el entrenador antes de la hora de inicio (F3), así que el sustituto no puede marcar la asistencia (solo administración desde el detalle). Decidir si se permite cambiar el entrenador (solo eso) en sesiones empezadas o pasadas del día. Anotado el 2026-10-15

## Fase 6 · Auditoría de seguridad
- [ ] [C] `docs/AUDIT.md` por gravedad: filtrado por usuario en cada consulta a Neon, sesión de Neon Auth, autorización, validación, secretos, cabeceras/CSP, límite de peticiones, dependencias, subida de archivos y protección de datos (lo que dice `/privacidad` coincide con lo que hace la app: datos que se guardan, proveedores, conservación, eliminación de cuenta y vaciado de la caché al cerrar sesión)
- [ ] [C] Separar desarrollo y producción antes de tener clientes reales: rama de desarrollo de Neon para `.env.local` y sin `NEON_API_KEY`/`NEON_PROJECT_ID`/`NEON_AUTH_BRANCH_ID` en local (hoy «Eliminar mi cuenta» en local borra usuarios reales). Desbloquea apagar «Allow Localhost» (Fase 7). AUDITORIA-2026-10-12 #2
- [ ] [C] `npm audit`: revisar los avisos altos de herramientas de desarrollo (`braces`/`fast-glob` vía `eslint-config-next` y `shadcn`; `esbuild` vía `drizzle-kit`) y actualizarlos o justificarlos en `docs/AUDIT.md`. AUDITORIA-2026-10-12 #3
- [ ] [T] Activar las alertas de Dependabot y las actualizaciones de seguridad (GitHub → Settings → Code security): hoy están desactivadas. AUDITORIA-2026-10-14 #2
- [ ] [C] Borrar o reutilizar `getBookingForViewer` (`lib/data/bookings.ts`), que ya no se usa fuera de sus tests. AUDITORIA-2026-10-14 #3
- [ ] 🛑 [T] Revisar la auditoría
- [ ] [C] Corregir los puntos críticos, un commit por punto

## Fase 7 · Rendimiento y publicación web
- [ ] [C] Lighthouse (rendimiento, accesibilidad, buenas prácticas, SEO) → cifras en `docs/PERF.md`
- [ ] [C] Imágenes con `next/image`, carga diferida, índices para consultas lentas
- [ ] [J] Uso comercial: Vercel Hobby no lo permite; antes de abrir la app al gimnasio real, Vercel Pro u otro alojamiento (LIMITS D1)
- [ ] [T] Dar los datos del titular del gimnasio para los textos legales (razón social, NIF, dirección, correo de privacidad) → `lib/legal.ts`. Recomendable que un profesional revise `/privacidad` y `/aviso-legal` antes de abrir la app al gimnasio real
- [ ] [J] Firmar o aceptar los contratos de encargado del tratamiento (DPA, RGPD art. 28) de Vercel y Neon, y registrar las actividades de tratamiento del gimnasio (RGPD art. 30)
- [ ] [C] Antes de abrir la app al gimnasio real: `lib/legal.ts` completo (`isLegalComplete` en `true`, sin aviso de "Borrador") y fecha de `updatedAt` al día
- [ ] [T] Dominio propio en Vercel
- [x] [T] Google con credenciales propias en Neon Auth (hecho 2026-10-11): proyecto «Athlos App» en Google Cloud (público Externo, **En producción**, sin logo, así que sin verificación), cliente OAuth web «Athlos Neon Auth» con redirección `{NEON_AUTH_BASE_URL}/callback/google`, ID y secreto en Neon (proveedor `google` de tipo `standard`, cambiado por API sin quitarlo). Login probado en la web: misma cuenta, sin duplicados
- [ ] [J] La pantalla de Google muestra «neon.tech» y no «Athlos», porque el nombre solo aparece con la marca verificada, y eso exige ser dueño de los dominios autorizados (`neon.tech` no lo es). Con el dominio propio, ver si Neon Auth admite un dominio personalizado para su URL; si no, aceptarlo o valorarlo
- [ ] [J] Apagar «Allow Localhost» en Neon Auth (lista de producción de Neon). Antes, separar desarrollo y producción: hoy `.env.local` apunta a la base de datos de producción y el login en `localhost` depende de ese ajuste
- [ ] [T] Probar la web publicada en un móvil real, instalada como PWA en Android y en iPhone (icono, pantalla completa, sin conexión y push)

## Fase 8 · App móvil (Capacitor) ⏸️ en pausa
**En pausa desde el 2026-10-15** (decisión del usuario): publicar en las tiendas exige cuentas de pago (Apple Developer anual), contratos y revisiones. La app se usa como **PWA instalada desde el navegador** (manifest, iconos y service worker de la Fase 2; pantalla «Instalar la app» en la Fase 5) y las push son web (F10). Esta fase no bloquea la Fase 9; se retoma solo si el usuario lo decide.

La app nativa carga la web publicada en Vercel (SSR), así que las mejoras de la web llegan sin recompilar.
- [ ] [C] Capacitor con plataformas Android e iOS; iconos y splash
- [ ] [C] Plugins nativos según SPEC (push, cámara, compartir, barra de estado). Apple rechaza las apps que solo envuelven una web
- [ ] [C] Deep links para volver a la app después del login
- [ ] [C] Ocultar "Continuar con Google" en la app de iOS (Capacitor) y dejar solo correo y contraseña: Neon Auth no admite Sign in with Apple (comprobado el 2026-10-07: solo Google, GitHub y Vercel), y la norma 4.8 de la App Store lo exige si se ofrece un login de terceros. En Android y la web se mantiene Google
- [ ] [T] Cuentas: Google Play Console (pago único) y Apple Developer (anual)
- [ ] [T] Compilar iOS: requiere Mac con Xcode o un servicio en la nube (Codemagic, Appflow). Android funciona en Windows con Android Studio
- [ ] [J] Pruebas internas: TestFlight y pista interna de Play Console
- [x] [C] Política de privacidad pública (`/privacidad`) y aviso legal (`/aviso-legal`), enlazados desde login, registro y perfil (adelantado el 2026-10-04)
- [ ] [C] Revisar que `/privacidad` sigue al día (proveedores, permisos nativos) y comprobar que la eliminación de cuenta funciona desde la app (requisitos de App Store y Google Play)
- [ ] 🛑 [T] Enviar a revisión en las tiendas

## Fase 9 · Mantenimiento
- Semanal: errores de Sentry y PR de Dependabot. `@neondatabase/auth` (beta) va en PR propia: leer el changelog y probar login, registro, Google y eliminar cuenta antes de fusionar (AUDITORIA-2026-10-12 #4)
- Node local: actualizar a ≥ 24.15 (aviso EBADENGINE de `w3c-xmlserializer` en `npm ci`; AUDITORIA-2026-10-14 #4)
- Mensual: consumo en Neon (CU-h, almacenamiento, ramas), Vercel (uso y Blob) y Sentry frente a `docs/LIMITS.md`; volver a comprobar las cifras del documento
- Mensual: repetir la Fase 6
- Tras cada funcionalidad: actualizar SPEC y ARCHITECTURE
- App móvil: recompilar solo si cambian plugins, iconos o permisos nativos
