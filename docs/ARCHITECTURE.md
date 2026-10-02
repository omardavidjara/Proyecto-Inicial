# Arquitectura · Athlos App

> Basada en `docs/SPEC.md`. Estado: borrador para revisión (Fase 1).

## 1. Visión general

```
Navegador / App Capacitor
        │  (HTML + RSC, Server Actions)
        ▼
Next.js 16 en Vercel ── proxy.ts (solo redirecciones optimistas por cookie)
        │
        ├─ Server Components  → lib/dal (verifica sesión + rol) → db (Drizzle)
        ├─ Server Actions     → Zod → lib/dal → db
        └─ Route Handlers     → /api/cron/* (Vercel Cron), /api/auth/* (Neon Auth)
                                         │
                                         ▼
                              Neon Postgres
                              ├─ esquema neon_auth  (lo gestiona Neon Auth)
                              └─ esquema public     (tablas de la app, Drizzle)
```

- **Neon Auth** (Better Auth gestionado) guarda usuarios y sesiones en `neon_auth` (`neon_auth.user`, etc.). No se toca a mano.
- Las tablas de la app viven en `public`, se definen en `db/schema.ts` y se migran con drizzle-kit.
- **Toda** lectura/escritura pasa por el servidor. El cliente nunca recibe `DATABASE_URL`.
- Hora: se guarda en `timestamptz` (UTC) y se muestra en la zona del gimnasio (`gym_settings.timezone`).

## 2. Enlace usuarios ↔ datos

- `profiles.user_id` = `neon_auth.user.id` (clave primaria de `profiles`, FK con `on delete cascade`).
- `profiles` se crea en el **primer inicio de sesión** (estado `pending`, rol `client`) si no existe.
- El **rol y el estado viven en `profiles`**, no en Neon Auth: así los cambia la app con sus propias reglas.
- Todas las demás tablas que pertenecen a una persona referencian `profiles.user_id`.
- El rol `developer` se asigna a mano una sola vez (semilla con migración/script), nunca desde la UI.

> A verificar en Fase 3: tipo exacto de `neon_auth.user.id` (texto/uuid) para declarar la FK en Drizzle.

## 3. Tablas (`public`)

Convenciones: `id uuid` (default `gen_random_uuid()`), `created_at`/`updated_at timestamptz`, nombres en inglés y `snake_case`.

### `profiles`
| columna | tipo | notas |
|---|---|---|
| user_id | text PK, FK → neon_auth.user.id | |
| full_name | text | |
| phone | text null | |
| avatar_url | text null | foto de perfil (almacenamiento: ver §11) |
| role | enum `developer \| admin \| coach \| client` | default `client` |
| status | enum `pending \| active \| inactive` | default `pending` |
| approved_at, deactivated_at | timestamptz null | |

### `gym_settings` (una sola fila)
| columna | tipo | default |
|---|---|---|
| id | smallint PK = 1 | |
| name | text | |
| timezone | text | `Europe/Madrid` |
| booking_window_days | int | 7 |
| cancel_deadline_minutes | int | 120 |
| reminder_minutes | int | 120 |
| late_cancel_consumes | boolean | true |

### `class_types`
id, name, kind enum `group | individual`, duration_minutes, default_capacity, color, is_active.

### `schedule_slots` (plantilla semanal)
id, class_type_id → class_types, weekday (0 = lunes … 6), start_time (`time`), duration_minutes, capacity, coach_id → profiles null, valid_from `date`, valid_to `date null`, is_active.

### `sessions`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| class_type_id | FK → class_types | |
| slot_id | FK → schedule_slots null | null = sesión suelta |
| starts_at, ends_at | timestamptz | |
| capacity | int | |
| coach_id | FK → profiles null | |
| status | enum `scheduled \| cancelled` | |
| cancel_reason | text null | |

Único `(slot_id, starts_at)` para que generar sesiones desde la plantilla sea idempotente.

### `bookings`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| session_id | FK → sessions | |
| user_id | FK → profiles | |
| status | enum `confirmed \| waitlisted \| cancelled \| late_cancelled` | |
| attendance | enum `pending \| attended \| no_show` | default `pending` |
| created_by | FK → profiles | el propio cliente o un admin |
| waitlisted_at | timestamptz null | orden de la lista de espera |
| cancelled_at | timestamptz null | |

Único parcial `(session_id, user_id) where status in ('confirmed','waitlisted')`: un cliente no puede tener dos reservas vivas en la misma sesión.

### `plans` (tarifas)
id, name, period enum `week | month | unlimited`, classes_per_period int null, is_active.

### `memberships` (tarifa asignada a un cliente)
id, user_id → profiles, plan_id → plans, starts_on `date`, ends_on `date null`. La vigente es la que cubre la fecha de la sesión. Historial completo.

### `incidents`
id, title, description, priority enum `low | medium | high`, status enum `open | in_progress | closed`, user_id → profiles null (cliente afectado), session_id → sessions null, created_by → profiles, assigned_to → profiles null, closed_at.

### `announcements`
id, title, body, created_by → profiles, published_at.

### `push_devices`
id, user_id → profiles, platform enum `web | android | ios`, token text único, last_seen_at.

### `notifications` (registro de envíos, evita duplicados)
id, user_id, kind enum `reminder | waitlist_promoted | session_cancelled | account_approved | announcement`, ref_id uuid null, sent_at. Único `(user_id, kind, ref_id)`.

### Relaciones
```
neon_auth.user 1─1 profiles 1─* bookings *─1 sessions *─1 class_types
                    │  1─* memberships *─1 plans          │ *─1 schedule_slots *─1 class_types
                    │  1─* incidents (user / created_by / assigned_to)
                    │  1─* push_devices
                    └─ coach_id en sessions y schedule_slots
```

## 4. Reglas de negocio en el servidor

Todas en `lib/booking.ts` (funciones puras testeables) + una transacción en la capa de datos.

**Reservar** (transacción):
1. `SELECT … FROM sessions WHERE id = $1 FOR UPDATE` (bloquea la sesión → no hay sobreventa con reservas simultáneas).
2. Comprobar: perfil `active`, sesión `scheduled`, `now()` dentro de la ventana (`starts_at - booking_window_days` … `starts_at`), sin reserva viva previa.
3. Comprobar cupo de la tarifa: reservas `confirmed`, `late_cancelled` (si consume) y `no_show` del periodo (semana ISO o mes natural de la sesión) < `classes_per_period`.
4. Si hay plaza → `confirmed`; si no → `waitlisted` (sin consumir cupo).

**Anular**: si faltan ≥ `cancel_deadline_minutes` → `cancelled`; si no → `late_cancelled`. Después, **promover** de la lista de espera (misma transacción): el primer `waitlisted` por `waitlisted_at` cuya tarifa lo permita pasa a `confirmed` → notificación.

**Modificar** = anular + reservar la nueva sesión en una sola transacción; si la nueva falla, no se anula la antigua.

**Cancelar sesión** (admin): sesión `cancelled`, reservas vivas `cancelled` (sin consumir), notificación a afectados.

Los administradores pueden forzar una reserva (saltar aforo/cupo/ventana); queda `created_by` = admin.

> Driver: las transacciones interactivas necesitan el `Pool` (WebSocket) de `@neondatabase/serverless`, no el driver HTTP. Se usa el Pool para escrituras con transacción y HTTP para lecturas simples.

## 5. Rutas (App Router)

Grupos de rutas para separar layouts por rol (los paréntesis no forman parte de la URL). UI en español, carpetas con la URL que verá el usuario.

```
app/
  (auth)/login                     Inicio de sesión
  (auth)/registro                  Registro
  (auth)/pendiente                 Alta pendiente de aprobación
  (client)/calendario              Calendario (inicio del cliente)
  (client)/calendario/[sessionId]  Detalle de sesión
  (client)/reservas                Mis reservas
  (client)/avisos                  Avisos
  (client)/perfil                  Perfil
  entrenador/                      Mis clases
  entrenador/sesiones/[sessionId]  Asistentes + marcar asistencia
  admin/                           Hoy
  admin/agenda                     ?vista=dia|semana|mes&fecha=AAAA-MM-DD
  admin/sesiones/[sessionId]       Detalle de sesión
  admin/horario                    Plantilla semanal
  admin/tipos-clase
  admin/clientes                   ?estado=pendiente|activo|baja&q=
  admin/clientes/[userId]
  admin/tarifas
  admin/incidencias                ?estado=
  admin/incidencias/[incidentId]
  admin/avisos
  admin/ajustes
  admin/equipo                     Solo desarrollador
  api/auth/[...path]               Neon Auth
  api/cron/generate-sessions       Diario: crea sesiones de la plantilla (próximas 4 semanas)
  api/cron/reminders               Cada 15 min: recordatorios de clase
```

- `/` redirige según rol: cliente → `/calendario`, entrenador → `/entrenador`, admin/desarrollador → `/admin`.
- **Vista cliente** para admins: simplemente pueden abrir las rutas de `(client)`; el layout de admin tiene un enlace "Vista cliente" y viceversa.
- Mutaciones: **Server Actions** (en `app/**/actions.ts`), cada una valida con Zod y llama a la capa de datos.
- `api/cron/*` exige la cabecera `Authorization: Bearer $CRON_SECRET`.

## 6. Permisos

Dos capas (según la guía de autenticación de Next 16):
1. **`proxy.ts`** — comprobación optimista: sin cookie de sesión → `/login`. No consulta la base de datos.
2. **Capa de datos `lib/dal.ts`** (la que de verdad protege): `getCurrentUser()` (memorizada con `cache`) verifica la sesión de Neon Auth y carga `profiles`; `requireRole(...roles)` y `requireActive()` lanzan/redirigen. Toda consulta usa el `user_id` de esa sesión, nunca uno que venga del cliente salvo para admins.

| Acción | client | coach | admin | developer |
|---|:-:|:-:|:-:|:-:|
| Ver calendario y plazas libres | ✔ | ✔ | ✔ | ✔ |
| Reservar / anular **para sí** | ✔ (activo) | — | ✔ | ✔ |
| Ver mis reservas | ✔ | — | ✔ | ✔ |
| Ver asistentes de una sesión | — | solo las suyas | ✔ | ✔ |
| Marcar asistencia | — | solo las suyas | ✔ | ✔ |
| Reservar / anular **para otro**, forzar plaza | — | — | ✔ | ✔ |
| Crear / cancelar sesiones, horario, tipos | — | — | ✔ | ✔ |
| Clientes: aprobar, baja, tarifa | — | — | ✔ | ✔ |
| Tarifas | — | — | ✔ | ✔ |
| Incidencias: crear | — | ✔ | ✔ | ✔ |
| Incidencias: ver / gestionar | — | las suyas | ✔ | ✔ |
| Avisos: publicar | — | — | ✔ | ✔ |
| Ajustes del gimnasio | — | — | ✔ | ✔ |
| Asignar roles admin / coach | — | — | — | ✔ |

Cliente `pending` o `inactive`: solo `/pendiente` y `/perfil`.

## 7. Estructura de carpetas

```
app/            rutas (ver §5)
components/     UI (components/ui = shadcn)
db/schema.ts    esquema Drizzle
db/index.ts     cliente Drizzle (solo servidor: import 'server-only')
drizzle/        migraciones generadas
lib/auth.ts     Neon Auth (servidor)
lib/dal.ts      sesión, rol y consultas autorizadas
lib/booking.ts  reglas de reserva (puras)
lib/validation/ esquemas Zod
__tests__/      tests
```

## 8. Índices

Además de las PK y los únicos ya citados (en Postgres las FK **no** crean índice solas):

| Tabla | Índice | Para |
|---|---|---|
| sessions | `(starts_at)` | calendario y agenda por rango de fechas |
| sessions | `(coach_id, starts_at)` | "Mis clases" del entrenador |
| bookings | `(session_id, status)` | ocupación y asistentes de una sesión |
| bookings | `(session_id, waitlisted_at) where status = 'waitlisted'` | siguiente de la lista de espera |
| bookings | `(user_id, created_at desc)` | mis reservas / ficha de cliente |
| memberships | `(user_id, starts_on desc)` | tarifa vigente |
| profiles | `(status, role)` | altas pendientes, filtros de clientes |
| profiles | `gin (full_name gin_trgm_ops)` (extensión `pg_trgm`) | búsqueda de clientes por nombre |
| incidents | `(status, created_at desc)` | lista de incidencias |
| incidents | `(user_id)`, `(session_id)` | incidencias en ficha de cliente / sesión |
| announcements | `(published_at desc)` | avisos |
| push_devices | `(user_id)` | envío de notificaciones |

El cupo de la tarifa se calcula con `bookings` unido a `sessions` por rango de `starts_at` del periodo; con los índices anteriores es una consulta acotada (un cliente tiene pocas reservas por mes). Si crece, se añade un índice `(user_id, status)`.

## 9. Paginación

| Lista | Estrategia |
|---|---|
| Calendario, agenda día/semana/mes, "Mis clases" | **Sin paginar**: se consulta un rango de fechas acotado (`fecha`, `vista`) |
| Clientes, incidencias, historial de reservas, avisos | **Por cursor** (keyset) sobre `(created_at, id)` o `(full_name, user_id)`, 20 por página, botón "Cargar más". Nada de `OFFSET` |
| Asistentes y lista de espera de una sesión | Sin paginar (limitado por el aforo) |

Los filtros y la página viven en la URL (`searchParams`), así se pueden compartir y el botón atrás funciona.

## 10. Reparto servidor / cliente

- **Por defecto, Server Components**: páginas y listas se renderizan en el servidor con datos de `lib/dal.ts`. No hay API REST interna ni `fetch` desde el navegador a la base de datos.
- **Client Components** (`'use client'`) solo para interacción: selector de día/semana del calendario, botones de reservar/anular (con `useOptimistic` y estado pendiente), formularios con validación inmediata, diálogos, menús, cambio de vista.
- Los Client Components reciben **DTOs** mínimos (solo los campos necesarios); nunca objetos completos de la base de datos ni datos de otros usuarios.
- **Mutaciones** → Server Actions → Zod → `lib/dal.ts` → `revalidatePath`/`refresh` de la ruta afectada.
- `db/` y `lib/dal.ts` importan `server-only` para que el build falle si alguien los usa desde el cliente.
- Tareas periódicas (generar sesiones, recordatorios) → Vercel Cron, nunca en el cliente.

## 11. Decisiones pendientes para fases posteriores

- **Fotos de perfil**: almacenamiento (Vercel Blob propuesto) → Fase 5, al implementar F1.
- **Push**: Web Push (PWA) y FCM/APNs vía Capacitor → Fase 8; la tabla `push_devices` sirve para ambos.
- **Sin conexión**: el service worker cachea "Mis reservas" (solo lectura) → Fase 2 (básico) y Fase 8.
