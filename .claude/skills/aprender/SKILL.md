---
name: aprender
description: Lleva al harness (repo omardavidjara/claude-harness) lo aprendido en un proyecto - reglas de trabajo, patrones, lecciones de proveedores, plantillas mejoradas - y lo sube a GitHub para que sirva en todos los proyectos futuros. Úsala cuando el usuario diga "aprende esto", "apúntalo para siempre", "mejora el harness", al cerrar una fase o cuando una lección sirva para cualquier proyecto.
---

# Mejorar el harness

## 1. Localiza el clon
La ruta está en `~/.claude/CLAUDE.md` (línea "Clon local del harness"). Si no existe: `gh repo clone omardavidjara/claude-harness <Proyectos>/claude-harness`. Haz `git pull` antes de tocar nada.

## 2. Decide dónde va cada lección
| Tipo de lección | Dónde |
|---|---|
| Cómo quiere trabajar el usuario (tono, ritmo, permisos, delegación) | `global/CLAUDE.md` |
| Paso del proceso (planificar, PR, cerrar fase, auditar) | la skill correspondiente en `plugin/skills/` |
| Conocimiento de un stack (SDK, proveedor, límite, error real) | `plugin/skills/stack-<stack>/references/` (o una skill de stack nueva) |
| Archivo reutilizable (workflow, script, config, doc base) | `plugin/skills/nuevo-proyecto/templates/` o `stack-*/templates/` |
| Proyecto nuevo o cambio de estado de uno | `PROYECTOS.md` |

Criterios:
- **Solo lo general**. Lo específico de un proyecto se queda en su memoria o sus docs.
- Generaliza nombres (`{{proyecto}}`, sin datos del cliente, sin claves, sin URLs privadas).
- Breve: una regla con su porqué en una línea. Si contradice algo existente, sustitúyelo; no acumules.
- Cifras de proveedores con fecha de comprobación ("comprobado AAAA-MM-DD").

## 3. Publica
1. Enséñale al usuario el resumen de cambios (qué y dónde) en pocas líneas.
2. Sube la versión en `plugin/.claude-plugin/plugin.json` (parche para texto, menor para skills o plantillas nuevas).
3. `claude plugin validate .` en la raíz del clon.
4. Commit `harness: <resumen>` y `git push` (en este repo se trabaja directamente en `main`).
5. Actualiza la instalación: `powershell -ExecutionPolicy Bypass -File install.ps1` desde el clon. Los cambios de skills se ven en la siguiente sesión.
6. **Proyectos sincronizados** (los que tienen `.claude/harness/manifest.json`, ver `PROYECTOS.md`): llevan una copia del harness para la nube. Ofrece actualizarlos: en cada uno, rama `chore/sync-harness`, `node <clon>/sync-project.mjs <proyecto>`, commit `chore(harness): sincronizar con <versión>` y PR.
