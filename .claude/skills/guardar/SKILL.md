---
name: guardar
description: Punto de guardado antes de /clear o al terminar una sesión - deja en la memoria del proyecto dónde estamos, qué falta comprobar y lo aprendido, para que la siguiente sesión retome sin releer todo. Úsala cuando el usuario diga "guarda", "punto de guardado", "vamos a cerrar", "/clear" o al terminar una fase o un bloque largo.
---

# Punto de guardado

Actualiza (no dupliques) el archivo de memoria `estado-<proyecto>` del proyecto, tipo `project`:

1. **Primera línea: `Punto de guardado (AAAA-MM-DD):`** qué está terminado (PRs fusionadas o abiertas), cuál es la **siguiente tarea** y si hay rama o cambios a medias.
2. **Comprobaciones con fecha**: lo que no se pudo verificar todavía y cómo hacerlo ("el 15-oct, consulta solo lectura a `sessions` para ver si el cron creó…").
3. **Lecciones del proyecto** que ahorran tiempo la próxima vez (patrón a copiar, quirk del SDK, código de error real, qué bloquea el modo automático). Breves.
4. Borra lo que ya no es verdad o ya está en el repo (ROADMAP, docs, git log): la memoria no repite el repo.

Fechas siempre absolutas. Luego dile al usuario en una línea qué se guardó y recomienda `/clear`.

Si alguna lección vale para **cualquier proyecto**, propón la skill `aprender` para llevarla al harness.
