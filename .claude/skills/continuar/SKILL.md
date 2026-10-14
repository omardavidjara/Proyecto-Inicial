---
name: continuar
description: Retoma el trabajo de un proyecto siguiendo su docs/ROADMAP.md (protocolo de sesión con etiquetas [C]/[T]/[J]/🛑). Úsala cuando el usuario diga "continúa", "seguimos", "siguiente tarea", "¿por dónde íbamos?" o al abrir una sesión en un proyecto con ROADMAP.
---

# Continuar un proyecto

1. **Estado**: lee la memoria del proyecto (punto de guardado) y `docs/ROADMAP.md`. Nada más todavía.
   - Si la memoria tiene comprobaciones con fecha ya pasada (un cron, un despliegue), pide confirmarlas primero.
   - `git status` y `git branch --show-current`: si hay cambios sin commit o una rama abierta, eso va antes que nada (es trabajo a medias de la sesión anterior).
2. **Tarea**: la fase activa es la primera con casillas abiertas; toma la primera casilla abierta.
3. **Según la etiqueta**:
   - **[C]** lo hace Claude: hazla y sigue con la siguiente [C] sin preguntar.
   - **[T]** la hace el usuario (cuentas, claves, revisar): dile exactamente qué hacer, **un paso por mensaje**, y espera.
   - **[J]** decisión del usuario: propone una opción recomendada con su porqué (coste, límites de `docs/LIMITS.md`) y espera el OK.
   - **🛑** punto de control: resume lo hecho y espera el OK.
   - Funcionalidades (Fase 5 o similar): sigue la skill `funcionalidad`.
4. **Por cada tarea terminada**: `npm run check` → commit → marca `[x]` en el ROADMAP con una nota corta (fecha, PR, decisiones, pendientes heredados).
5. **No empieces una fase** sin cerrar todas las casillas de la anterior. Al cerrar una fase: skill `cerrar-fase`.
6. **Al acabar la sesión** (o si el contexto se alarga): skill `guardar` y recomienda `/clear`.

Lee los demás documentos (`SPEC`, `ARCHITECTURE`, `DESIGN`, `LIMITS`) solo cuando la tarea los necesite.
