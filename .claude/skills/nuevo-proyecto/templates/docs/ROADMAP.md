# Hoja de ruta

Plan del proyecto. Claude la lee al inicio de cada sesión y marca las casillas al terminar cada tarea.

Etiquetas: **[C]** lo hace Claude solo · **[T]** requiere al usuario (cuentas, claves, revisión) · **[J]** Claude propone o pregunta, el usuario aprueba.
🛑 = punto de control: Claude se detiene y espera el OK del usuario.

## Protocolo de sesión (Claude)

1. Leer esta hoja. La fase activa es la primera con casillas abiertas.
2. Hacer seguidas las tareas [C] de la fase activa, en orden. Por cada tarea: implementar → `npm run check` → commit → marcar `[x]` aquí (con fecha, PR y pendientes heredados).
3. Parar en la primera tarea [T], [J] o 🛑: decir al usuario exactamente qué necesita hacer o decidir (un paso por mensaje).
4. No empezar una fase hasta cerrar todas las casillas de la anterior. Al cerrar una fase: revisión en `docs/reviews/FASE-N.md`.
5. Al cerrar una fase o una sesión larga: punto de guardado y recomendar `/clear`. Desde que `main` está protegida, todo cambio va por rama y PR, y se fusiona con la CI en verde cuando el usuario lo pide.
6. Nunca: subir secretos, exponer claves de servidor al cliente, fusionar con la CI en rojo o tocar la base de datos de producción sin migración.

Límites de los planes gratuitos y alternativas: `docs/LIMITS.md`. Revisarlo antes de cada plan de tarea.

## Fase 0 · Cimientos
- [ ] [T] Node.js, Git, VS Code, Claude Code y `gh` instalados; cuentas en GitHub y Vercel
- [ ] [C] Proyecto creado y subido a GitHub
- [ ] [C] CLAUDE.md, ROADMAP, LIMITS
- [ ] [C] Tests; `npm run check` = lint + tipos + tests; hook de Claude Code
- [ ] [C] CI (`.github/workflows/ci.yml`) y Dependabot
- [ ] [T] Protección de rama en `main` exigiendo la CI

## Fase 1 · Especificación y arquitectura
- [ ] [J] Entrevista al usuario → `docs/SPEC.md` (qué hace, usuarios, funcionalidades F1…Fn, pantallas, datos)
- [ ] [J] Qué necesita el móvil (notificaciones, cámara, sin conexión…)
- [ ] [C] `docs/ARCHITECTURE.md`: tablas, relaciones, rutas, permisos, índices, paginación, reparto servidor/cliente
- [ ] 🛑 [T] Revisar y corregir SPEC y ARCHITECTURE

## Fase 2 · Sistema de diseño y prototipo
- [ ] [C] `docs/DESIGN.md`: principios, tokens de color (AA en claro y oscuro), tipografía, estados de carga/vacío/error
- [ ] [C] Componentes base; móvil primero (zonas táctiles ≥ 44 px, navegación inferior, safe areas)
- [ ] [C] Prototipo de las 2–3 pantallas clave con datos de ejemplo
- [ ] 🛑 [T] Revisar el prototipo (también en un móvil)

## Fase 3 · Datos y seguridad base
- [ ] [T] Cuenta y proyecto de base de datos (región cercana a los usuarios) y claves para `.env.local`
- [ ] [T] Autenticación: métodos de login y URL de redirección
- [ ] [T] Conectar el repo al alojamiento y copiar variables de entorno
- [ ] [J] Copias de seguridad (si el plan gratuito no las da)
- [ ] [C] ORM, esquema y migraciones; tests contra base de datos real en memoria
- [ ] [C] Login, rutas protegidas por rol, capa de datos solo en servidor filtrando por usuario
- [ ] [C] Test con dos usuarios: ninguno ve los datos del otro

## Fase 4 · Auto-auditoría automatizada
- [ ] [C] CI completa (lint, tipos, tests, migraciones coherentes, build, `npm audit` de producción bloqueante)
- [ ] [J] Monitor de errores (Sentry, región UE, sin datos personales)

## Fase 5 · Funcionalidades (una por sesión, en el orden de SPEC)
Ciclo: rama → 🛑 plan y OK → implementar con tests → check → push → CI verde → PR → [T] el usuario pide fusionar.
- [ ] F1 · {{…}}

## Fase 6 · Auditoría de seguridad
- [ ] [C] `docs/AUDIT.md` por gravedad: filtrado por usuario, sesión, autorización, validación, secretos, cabeceras/CSP, límite de peticiones, dependencias, subidas, protección de datos
- [ ] [C] Separar desarrollo y producción (base de datos de desarrollo para local) antes de tener usuarios reales
- [ ] 🛑 [T] Revisar la auditoría
- [ ] [C] Corregir los puntos críticos, un commit por punto

## Fase 7 · Rendimiento y publicación
- [ ] [C] Lighthouse → `docs/PERF.md`
- [ ] [J] ¿Uso comercial? Revisar condiciones del plan gratuito del alojamiento
- [ ] [T] Datos del titular para los textos legales; dominio propio
- [ ] [T] Probar la web publicada en un móvil real

## Fase 8 · Mantenimiento
- Semanal: errores del monitor y PR de Dependabot
- Mensual: consumo frente a `docs/LIMITS.md`; repetir la auditoría
- Tras cada funcionalidad: actualizar SPEC y ARCHITECTURE
