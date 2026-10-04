# Hoja de ruta

Plan del proyecto. Claude la lee al inicio de cada sesión y marca las casillas al terminar cada tarea.

Etiquetas: **[C]** lo hace Claude solo · **[T]** requiere al usuario (cuentas, claves, revisión) · **[J]** Claude propone o pregunta, el usuario aprueba.
🛑 = punto de control: Claude se detiene y espera el OK del usuario.

## Protocolo de sesión (Claude)

1. Leer esta hoja. La fase activa es la primera con casillas abiertas.
2. Hacer seguidas las tareas [C] de la fase activa, en orden. Por cada tarea: implementar → `npm run check` → commit → marcar `[x]` aquí.
3. Parar en la primera tarea [T], [J] o 🛑: decir al usuario exactamente qué necesita hacer o decidir.
4. No empezar una fase hasta cerrar todas las casillas de la anterior.
5. Al cerrar una fase: hacer push y recomendar `/clear`.
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

## Fase 3 · Datos y seguridad base
- [ ] [T] Crear la cuenta y el proyecto en Neon (región AWS Frankfurt, `aws-eu-central-1`; autoescalado 0,25–1 CU, ver LIMITS D3) y dar a Claude `DATABASE_URL` (con pooling) y `DATABASE_URL_UNPOOLED` (directa, para migraciones) para `.env.local`
- [ ] [T] Activar Neon Auth en el proyecto (pestaña Auth de la consola), elegir los métodos de login, configurar las URL de redirección y dar a Claude sus claves
- [ ] [T] Conectar el repositorio a Vercel, añadir la integración de Neon (una rama de base de datos por cada preview) y copiar las variables de entorno
- [ ] [J] Tareas programadas: Vercel Hobby solo permite cron diario; confirmar la alternativa propuesta (programador externo en horario del gimnasio + ruta idempotente, LIMITS D2) o Vercel Pro
- [ ] [J] Copias de seguridad: Neon Free solo guarda 6 h de historial; decidir dónde guardar el `pg_dump` diario cifrado (LIMITS D5)
- [ ] [C] `vercel.json` con región `fra1`, *Ignored Build Step* para cambios solo de documentación y borrado de ramas de Neon al cerrar PR (LIMITS D3, D4, D6)
- [ ] [C] Drizzle ORM + driver serverless de Neon; esquema en `db/schema.ts` y migraciones en `drizzle/` generadas con drizzle-kit (nunca a mano en la consola de Neon)
- [ ] [C] Login con Neon Auth (SDK oficial, sesión en cookies); tabla `profiles` con el mismo `user_id` que `neon_auth.user`, creada en el primer inicio de sesión (sin FK hacia `neon_auth`, ver ARCHITECTURE §2)
- [ ] [C] Proteger las rutas: `(client)`, `admin/` y `entrenador/` exigen sesión y rol (hoy, prototipo, se abren sin login); `/` deja de ser el índice del prototipo y redirige a `/login` o al inicio de cada rol (ARCHITECTURE §5)
- [ ] [C] Capa de datos solo en servidor: cada consulta filtra por el `user_id` de la sesión verificada; validar toda entrada con Zod
- [ ] [C] Test con dos usuarios: ninguno ve los datos del otro

## Fase 4 · Auto-auditoría automatizada
- [ ] [C] `.github/workflows/ci.yml`: lint, tipos, tests, build, `npm audit --omit=dev` bloqueante (el completo solo como aviso, ver `docs/reviews/FASE-2.md` §5)
- [ ] [C] Hooks de Claude Code: `npm run check` tras cada edición
- [ ] [C] `.github/dependabot.yml`
- [ ] [J] Sentry: el usuario crea la cuenta y da el DSN; Claude lo integra
- [ ] [T] Protección de rama en `main` (Settings → Branches), exigiendo la CI

## Fase 5 · Funcionalidades (una por sesión, en el orden de SPEC)
Ciclo: rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → [T] el usuario fusiona.
Cada funcionalidad sustituye su parte del prototipo de la Fase 2: datos de `lib/prototype/` por consultas reales, páginas "Próximamente" (`components/coming-soon.tsx`) por las pantallas reales y la franja `PrototypeNotice`. Cuando no quede nada, borrar `lib/prototype/` y esos dos componentes.
- [ ] F1 · Registro, alta pendiente/aprobación, perfil con foto y bajas
- [ ] F2 · Tipos de clase (grupal / individual, aforo, color)
- [ ] F3 · Horario: plantilla semanal, generación de sesiones y sesiones sueltas/cancelación
- [ ] F4 · Tarifas y asignación a clientes
- [ ] F5 · Calendario y reservas del cliente (reservar, modificar, anular, lista de espera)
- [ ] F6 · Agenda del administrador (día / semana / mes) y anulaciones tardías
- [ ] F7 · Entrenadores: mis clases, asistentes y asistencia
- [ ] F8 · Gestión de clientes (lista, ficha, filtros)
- [ ] F9 · Incidencias
- [ ] F10 · Avisos y notificaciones push
- [ ] F11 · Equipo: roles y ajustes del gimnasio (solo desarrollador)

## Fase 6 · Auditoría de seguridad
- [ ] [C] `docs/AUDIT.md` por gravedad: filtrado por usuario en cada consulta a Neon, sesión de Neon Auth, autorización, validación, secretos, cabeceras/CSP, límite de peticiones, dependencias, subida de archivos
- [ ] 🛑 [T] Revisar la auditoría
- [ ] [C] Corregir los puntos críticos, un commit por punto

## Fase 7 · Rendimiento y publicación web
- [ ] [C] Lighthouse (rendimiento, accesibilidad, buenas prácticas, SEO) → cifras en `docs/PERF.md`
- [ ] [C] Imágenes con `next/image`, carga diferida, índices para consultas lentas
- [ ] [J] Uso comercial: Vercel Hobby no lo permite; antes de abrir la app al gimnasio real, Vercel Pro u otro alojamiento (LIMITS D1)
- [ ] [T] Dominio propio en Vercel
- [ ] [T] Probar la web publicada en un móvil real

## Fase 8 · App móvil (Capacitor)
La app nativa carga la web publicada en Vercel (SSR), así que las mejoras de la web llegan sin recompilar.
- [ ] [C] Capacitor con plataformas Android e iOS; iconos y splash
- [ ] [C] Plugins nativos según SPEC (push, cámara, compartir, barra de estado). Apple rechaza las apps que solo envuelven una web
- [ ] [C] Deep links para volver a la app después del login
- [ ] [T] Cuentas: Google Play Console (pago único) y Apple Developer (anual)
- [ ] [T] Compilar iOS: requiere Mac con Xcode o un servicio en la nube (Codemagic, Appflow). Android funciona en Windows con Android Studio
- [ ] [J] Pruebas internas: TestFlight y pista interna de Play Console
- [ ] [C] Política de privacidad pública (`/privacidad`) y comprobar que la eliminación de cuenta funciona desde la app (requisitos de App Store y Google Play)
- [ ] 🛑 [T] Enviar a revisión en las tiendas

## Fase 9 · Mantenimiento
- Semanal: errores de Sentry y PR de Dependabot
- Mensual: consumo en Neon (CU-h, almacenamiento, ramas), Vercel (uso y Blob) y Sentry frente a `docs/LIMITS.md`; volver a comprobar las cifras del documento
- Mensual: repetir la Fase 6
- Tras cada funcionalidad: actualizar SPEC y ARCHITECTURE
- App móvil: recompilar solo si cambian plugins, iconos o permisos nativos
