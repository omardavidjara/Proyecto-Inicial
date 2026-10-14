---
name: cerrar-fase
description: Cierra una fase del ROADMAP con una revisión escrita en docs/reviews/FASE-N.md (entregables, verificaciones, problemas corregidos y pendientes que heredan otras fases). Úsala cuando se marque la última casilla de una fase o el usuario pida "cerrar la fase" o "revisión de cierre".
---

# Revisión de cierre de fase

1. Verifica de verdad (no de memoria): `npm ci`, `npm run check`, `npm run build`, chequeos del stack (p. ej. `db:check`), `npm audit --omit=dev`, búsqueda de secretos en el repo y el historial, y lo que la fase prometa (despliegue, login, copia…). Si algo se puede comprobar en producción solo leyendo, hazlo.
2. Escribe `docs/reviews/FASE-N.md` con esta estructura:

```markdown
# Revisión de cierre · Fase N (Nombre)

Fecha: AAAA-MM-DD · Estado: **cerrada**. (Una frase: qué puede hacer ahora la app que antes no.)

## 1. Qué se entrega
| Entregable | Dónde |

## 2. Verificaciones
### Tests y compilación   (nº de tests ahora y al cerrar la fase anterior)
### De extremo a extremo  (qué se probó, dónde, con qué cuenta)
### Seguridad             (audit, secretos, cabeceras…)

## 3. Problemas encontrados y corregidos en esta fase
| # | Gravedad | Problema | Corrección |

## 4. Pendientes que heredan otras fases
| Pendiente | Fase |
```

3. Copia cada pendiente a su fase en `docs/ROADMAP.md` (si no, se pierde) y enlaza la revisión bajo el título de la fase cerrada (`Revisión de cierre: docs/reviews/FASE-N.md`). Marca la fase con ✅.
4. PR `docs: revisión de cierre de la Fase N`.
5. Propón `aprender` si la fase dejó lecciones generales (patrones, límites, errores de proveedores), y después `guardar` + `/clear`.

**Auditoría rápida** (fuera de un cierre, p. ej. tras una funcionalidad grande): usa la skill `auditoria`.
