# Arquitectura · {{Proyecto}}

> Basada en `docs/SPEC.md`. Estado: borrador / **aprobado** el AAAA-MM-DD.

## 1. Visión general
{{Diagrama en texto: navegador → app → capa de datos → base de datos; servicios externos.}}

## 2. Enlace usuarios ↔ datos
{{Cómo se relaciona el usuario de la autenticación con las tablas propias; rol y estado; eliminar cuenta (anonimizar vs borrar).}}

## 3. Tablas
### `{{tabla}}`
| Columna | Tipo | Notas |
|---|---|---|

### Relaciones

## 4. Reglas de negocio en el servidor

## 5. Rutas

## 6. Permisos
{{Dónde se comprueba (middleware optimista + capa de datos real) y tabla acción × rol.}}

## 7. Estructura de carpetas

## 8. Índices
(En Postgres las FK **no** crean índice solas.)

## 9. Paginación
Rangos acotados sin paginar; listas largas **por cursor** (keyset), nunca `OFFSET`. Filtros y página en la URL.

## 10. Reparto servidor / cliente
Server Components por defecto; Client Components solo para interacción y con DTOs mínimos; mutaciones por Server Actions → Zod → capa de datos → revalidar.

## 11. Decisiones pendientes

## 12. Historial de cambios
- AAAA-MM-DD · Versión inicial.
