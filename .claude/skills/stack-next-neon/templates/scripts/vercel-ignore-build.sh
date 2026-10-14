#!/usr/bin/env bash
# Ignored Build Step de Vercel (LIMITS D6): no construir si solo cambian documentos.
# Salida 0 = Vercel omite el build; cualquier otra = construye.
# Compara con el último despliegue correcto de la rama (VERCEL_GIT_PREVIOUS_SHA), no solo con el
# commit anterior: un push con varios commits cuyo último toca solo docs/ sí debe construirse.
# Ante cualquier duda (primer despliegue, SHA fuera del clon superficial), construye.
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "Sin despliegue previo comparable: se construye."
  exit 1
fi
# Mismo commit que el último despliegue = "Redeploy" pedido a mano (p. ej., tras cambiar variables): se construye
if [ "$(git rev-parse "$base^{commit}")" = "$(git rev-parse HEAD)" ]; then
  echo "Redeploy del mismo commit: se construye."
  exit 1
fi
if git diff --quiet "$base" HEAD -- . ':(exclude)docs/**' ':(exclude)*.md'; then
  echo "Solo cambian documentos: se omite el build."
  exit 0
fi
echo "Hay cambios de código: se construye."
exit 1
