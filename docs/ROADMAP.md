# Hoja de ruta

Versión operativa de `Planning Claude.docx`. Claude la lee al inicio de cada sesión y marca las casillas al terminar cada tarea.

Etiquetas: **[C]** lo hace Claude solo · **[T]** requiere al usuario (cuentas, claves, revisión) · **[J]** Claude propone o pregunta, el usuario aprueba.
🛑 = punto de control: Claude se detiene y espera el OK del usuario.

## Protocolo de sesión (Claude)

1. Leer esta hoja. La fase activa es la primera con casillas abiertas.
2. Hacer seguidas las tareas [C] de la fase activa, en orden. Por cada tarea: implementar → `npm run check` → commit → marcar `[x]` aquí.
3. Parar en la primera tarea [T], [J] o 🛑: decir al usuario exactamente qué necesita hacer o decidir.
4. No empezar una fase hasta cerrar todas las casillas de la anterior.
5. Al cerrar una fase: marcarla también en `Planning Claude.docx` (☐ → ☒), hacer push y recomendar `/clear`.
6. Nunca: subir secretos, usar `service_role` en el cliente, fusionar en `main` con la CI en rojo o tocar la base de datos de producción sin migración.

## Fase 0 · Cimientos ✅
- [x] [T] Instalar Node.js, Git, VS Code y Claude Code
- [x] [T] Cuentas en GitHub, Supabase y Vercel
- [x] [C] Proyecto Next.js + TypeScript + Tailwind
- [x] [C] Repositorio en GitHub con todo el proyecto subido
- [x] [C] CLAUDE.md con reglas y protocolo
- [x] [C] Vitest; `npm run check` = lint + tipos + tests
- [x] [C] docs/ROADMAP.md

## Fase 1 · Especificación y arquitectura
- [ ] [J] Entrevista al usuario → `docs/SPEC.md` (qué hace, usuarios, pantallas, datos)
- [ ] [J] Qué necesita el móvil: notificaciones, cámara, uso sin conexión… (define el alcance de la Fase 8)
- [ ] [C] `docs/ARCHITECTURE.md`: tablas, relaciones, rutas, permisos
- [ ] [C] Índices, paginación y reparto servidor/cliente
- [ ] 🛑 [T] Revisar y corregir SPEC y ARCHITECTURE

## Fase 2 · Sistema de diseño y PWA
- [ ] [C] `docs/DESIGN.md`: colores, tipografía, espaciados, estados de carga, vacío y error
- [ ] [C] shadcn/ui + botón, campo, tarjeta, diálogo, tabla
- [ ] [C] Diseño pensado primero para móvil: zonas táctiles de 44px o más, navegación inferior, safe areas
- [ ] [C] PWA: manifest, iconos, service worker básico y página sin conexión
- [ ] [C] Prototipo de las 2 o 3 pantallas clave
- [ ] 🛑 [T] Revisar el prototipo (también en un móvil)
- [ ] [C] Contraste, foco de teclado y comportamiento en móvil

## Fase 3 · Datos y seguridad base
- [ ] [T] Crear el proyecto en Supabase y dar a Claude URL + anon key (+ service_role) para `.env.local`
- [ ] [T] Conectar el repositorio a Vercel y copiar las variables de entorno
- [ ] [C] Migraciones en `supabase/migrations/` (nunca a mano en el panel)
- [ ] [C] RLS en todas las tablas, con una política por operación
- [ ] [C] Login con Supabase Auth
- [ ] [C] Permisos comprobados en servidor; validar toda entrada con Zod
- [ ] [C] Test con dos usuarios: ninguno ve los datos del otro

## Fase 4 · Auto-auditoría automatizada
- [ ] [C] `.github/workflows/ci.yml`: lint, tipos, tests, build, npm audit
- [ ] [C] Hooks de Claude Code: `npm run check` tras cada edición
- [ ] [C] `.github/dependabot.yml`
- [ ] [J] Sentry: el usuario crea la cuenta y da el DSN; Claude lo integra
- [ ] [T] Protección de rama en `main` (Settings → Branches), exigiendo la CI

## Fase 5 · Funcionalidades (una por sesión, en el orden de SPEC)
Ciclo: rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → [T] el usuario fusiona.
- [ ] (se llena desde docs/SPEC.md al cerrar la Fase 1)

## Fase 6 · Auditoría de seguridad
- [ ] [C] `docs/AUDIT.md` por gravedad: RLS, autorización, validación, secretos, cabeceras/CSP, límite de peticiones, dependencias, subida de archivos
- [ ] 🛑 [T] Revisar la auditoría
- [ ] [C] Corregir los puntos críticos, un commit por punto

## Fase 7 · Rendimiento y publicación web
- [ ] [C] Lighthouse (rendimiento, accesibilidad, buenas prácticas, SEO) → cifras en `docs/PERF.md`
- [ ] [C] Imágenes con `next/image`, carga diferida, índices para consultas lentas
- [ ] [T] Dominio propio en Vercel
- [ ] [T] Probar la web publicada en un móvil real

## Fase 8 · App móvil (Capacitor)
La app nativa carga la web publicada en Vercel (SSR), así que las mejoras de la web llegan sin recompilar.
- [ ] [C] Capacitor con plataformas Android e iOS; iconos y splash
- [ ] [C] Plugins nativos según SPEC (push, cámara, compartir, barra de estado). Apple rechaza las apps que solo envuelven una web
- [ ] [C] Deep links para volver a la app después del login de Supabase
- [ ] [T] Cuentas: Google Play Console (pago único) y Apple Developer (anual)
- [ ] [T] Compilar iOS: requiere Mac con Xcode o un servicio en la nube (Codemagic, Appflow). Android funciona en Windows con Android Studio
- [ ] [J] Pruebas internas: TestFlight y pista interna de Play Console
- [ ] 🛑 [T] Enviar a revisión en las tiendas

## Fase 9 · Mantenimiento
- Semanal: errores de Sentry y PR de Dependabot
- Mensual: repetir la Fase 6
- Tras cada funcionalidad: actualizar SPEC y ARCHITECTURE
- App móvil: recompilar solo si cambian plugins, iconos o permisos nativos
