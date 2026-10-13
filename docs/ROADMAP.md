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

## Fase 5 · Funcionalidades (una por sesión, en el orden de SPEC)
Ciclo: rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → [T] el usuario fusiona.
Cada funcionalidad sustituye su parte del prototipo de la Fase 2: datos de `lib/prototype/` por consultas reales, páginas "Próximamente" (`components/coming-soon.tsx`) por las pantallas reales y la franja `PrototypeNotice`. Cuando no quede nada, borrar `lib/prototype/` y esos dos componentes.
- [x] F1 · Registro, alta pendiente/aprobación, perfil con foto y bajas (el formulario de registro muestra `PrivacySummary` antes de enviar; perfil con enlaces legales y "Eliminar mi cuenta"). Pendiente de la Fase 3: el endpoint `delete-user` de Neon Auth está desactivado (404): activarlo en la consola o usar la API de administración de Neon para borrar la cuenta; las cuentas `pending` deben poder abrir `/perfil` (hoy solo `/pendiente`, ARCHITECTURE §6). Plan aprobado el 2026-10-11 en 5 PR: (1) registro ✅ — correo + código de 6 cifras, registro reactivado en Neon con verificación obligatoria (ARCHITECTURE §6); (2) perfil editable ✅ — nombre y teléfono, también para pendientes y bajas; `/pendiente` pide el teléfono a quien entra con Google; (3) altas y bajas en `/admin/clientes` ✅ — pestañas pendientes/activos/baja, aprobar, rechazar, dar de baja (anula reservas futuras en una transacción) y reactivar; «Altas pendientes» real en «Hoy». Pendiente para F5: promover la lista de espera al liberar plazas; para F4: asignar tarifa al aprobar; (4) foto en Vercel Blob ✅ — almacén «athlos-fotos» en fra1, público con nombre aleatorio, conectado a Production y Preview con `BLOB_READ_WRITE_TOKEN`; reducida en el navegador (512 px WebP, < 300 KB) y subida directa con token firmado solo para la carpeta propia; la anterior se borra al cambiarla o quitarla; (5) eliminar mi cuenta ✅ — confirmación escribiendo ELIMINAR; anonimiza el perfil, anula reservas futuras y dispositivos, borra la foto y el usuario de Neon Auth con una clave de organización limitada al proyecto («athlos-eliminar-cuentas»), solo en Production de Vercel (las previews comparten ids de usuario: no deben borrar). Terminada el 2026-10-11. Pendiente para la Fase 7: el correo del código llega en inglés y desde `auth@mail.myneon.app` (servidor compartido de Neon); con dominio propio, configurar un servidor de correo propio (permitiría también el enlace en vez del código)
- [x] Acceso a «Mi perfil» para administradores (detectado el 2026-10-12, hecho con F2): `/admin/perfil` con la navegación de administración, enlazado desde «Más»
- [x] F2 · Tipos de clase (grupal / individual, aforo, color). `/admin/tipos-clase`: crear, editar, activar/desactivar y eliminar (solo si no se ha usado nunca; si no, desactivar). La base de datos exige color de la paleta, individual = aforo 1 y nombre único sin distinguir mayúsculas (migración 0004). «Más» deja de ser «Próximamente»: menú real con las opciones que faltan marcadas. Terminada el 2026-10-13
- [x] F3 · Horario: plantilla semanal, generación de sesiones y sesiones sueltas/cancelación. Plan aprobado el 2026-10-13 en 2 PR: (1) plantilla semanal en `/admin/horario` y generación (al guardar y con el cron diario de Vercel `api/cron/generate-sessions`, `CRON_SECRET` solo en Production) ✅; (2) pestaña «Próximas sesiones» ✅: sesiones sueltas, mover, cambiar entrenador/aforo (`is_customized`, el aforo no baja de las confirmadas) y cancelar (definitivo, con motivo) anulando reservas. Terminada el 2026-10-13. Pendiente para F5: promover la lista de espera al subir el aforo; para F10: avisar por push a los afectados por una cancelación (hoy el diálogo pide avisarles a mano)
- [ ] F4 · Tarifas y asignación a clientes. Plan aprobado el 2026-10-13 en 2 PR: (1) catálogo en `/admin/tarifas` (crear, editar con aviso de cuántos clientes la tienen, activar/desactivar y eliminar solo si nunca se asignó; nombre único sin distinguir mayúsculas, migración 0005) ✅; (2) asignación: tarifa **opcional** al aprobar un alta, «Cambiar tarifa» con fecha de inicio e historial, cerrar la vigente al dar de baja, y tarifa real con clases restantes en la vista del cliente
- [ ] F5 · Calendario y reservas del cliente (reservar, modificar, anular, lista de espera)
- [ ] F6 · Agenda del administrador (día / semana / mes) y anulaciones tardías
- [ ] F7 · Entrenadores: mis clases, asistentes y asistencia
- [ ] F8 · Gestión de clientes (lista, ficha, filtros)
- [ ] F9 · Incidencias
- [ ] F10 · Avisos y notificaciones push
- [ ] F11 · Equipo: roles y ajustes del gimnasio (solo desarrollador)

## Fase 6 · Auditoría de seguridad
- [ ] [C] `docs/AUDIT.md` por gravedad: filtrado por usuario en cada consulta a Neon, sesión de Neon Auth, autorización, validación, secretos, cabeceras/CSP, límite de peticiones, dependencias, subida de archivos y protección de datos (lo que dice `/privacidad` coincide con lo que hace la app: datos que se guardan, proveedores, conservación, eliminación de cuenta y vaciado de la caché al cerrar sesión)
- [ ] [C] Separar desarrollo y producción antes de tener clientes reales: rama de desarrollo de Neon para `.env.local` y sin `NEON_API_KEY`/`NEON_PROJECT_ID`/`NEON_AUTH_BRANCH_ID` en local (hoy «Eliminar mi cuenta» en local borra usuarios reales). Desbloquea apagar «Allow Localhost» (Fase 7). AUDITORIA-2026-10-12 #2
- [ ] [C] `npm audit`: revisar los avisos altos de herramientas de desarrollo (`braces`/`fast-glob` vía `eslint-config-next` y `shadcn`; `esbuild` vía `drizzle-kit`) y actualizarlos o justificarlos en `docs/AUDIT.md`. AUDITORIA-2026-10-12 #3
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
- [ ] [T] Probar la web publicada en un móvil real

## Fase 8 · App móvil (Capacitor)
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
- Mensual: consumo en Neon (CU-h, almacenamiento, ramas), Vercel (uso y Blob) y Sentry frente a `docs/LIMITS.md`; volver a comprobar las cifras del documento
- Mensual: repetir la Fase 6
- Tras cada funcionalidad: actualizar SPEC y ARCHITECTURE
- App móvil: recompilar solo si cambian plugins, iconos o permisos nativos
