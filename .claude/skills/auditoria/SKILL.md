---
name: auditoria
description: Auditoría rápida del estado de un proyecto (comprobaciones, secretos, dependencias, cabeceras, revisión manual de las zonas sensibles) con informe en docs/reviews/AUDITORIA-AAAA-MM-DD.md y pendientes repartidos en el ROADMAP. Úsala cuando el usuario pida "revisa el proyecto", "auditoría", "¿está todo bien?" o tras cerrar una funcionalidad grande o rotar credenciales.
---

# Auditoría rápida

No corrige nada salvo que el usuario lo pida: informa y reparte pendientes.

## Comprobaciones (anota ✅/❌ en una tabla)
- `npm ci`, `npm run check` (nº de tests y archivos), `npm run build`, chequeos de esquema/migraciones.
- `npm audit --omit=dev` y `npm audit` completo: separa producción de herramientas de desarrollo.
- **Secretos** en archivos versionados **y en todo el historial**: `git log -p --all | grep -iE` con los patrones del stack (cadenas `postgres://…@`, `sk_`, `ghp_`, `gho_`, tokens de Blob/R2, `BEGIN … PRIVATE KEY`). `.env*` ignorados.
- Producción (si existe) solo leyendo: páginas clave responden, cabeceras de seguridad (HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, CSP).
- Qué variables llegan al navegador (`NEXT_PUBLIC_*`): ninguna secreta.

## Revisión manual (lista los archivos revisados)
Capa de acceso a datos, Server Actions / endpoints, subidas de archivos, rutas de cron, borrado de cuentas, middleware/proxy. Busca: consulta sin filtrar por el usuario de la sesión, id del navegador sin validar ni comprobar permiso, entrada sin Zod, errores que filtran detalles, local apuntando a producción con claves peligrosas.

## Informe
`docs/reviews/AUDITORIA-AAAA-MM-DD.md`: contexto (por qué ahora), tabla de comprobaciones, código revisado, y tabla `| # | Pendiente | Gravedad | Fase |`. Copia cada pendiente a su fase del ROADMAP y enlaza el informe. PR `docs: auditoría rápida del AAAA-MM-DD`.
