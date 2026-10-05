# Arquitectura · Athlos App

> Basada en `docs/SPEC.md`. Estado: **aprobado** el 2026-10-02 (cierre de la Fase 1).

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

- `profiles.user_id` = `neon_auth.user.id` (clave primaria de `profiles`). **Sin FK declarada** hacia `neon_auth`: ese esquema lo gestiona Neon y, al eliminar una cuenta, el perfil debe quedar anonimizado (no borrado) para conservar el historial. La integridad la garantiza la app: el perfil solo se crea a partir de una sesión verificada.
- `profiles` se crea en el **primer inicio de sesión** (estado `pending`, rol `client`) si no existe.
- El **rol y el estado viven en `profiles`**, no en Neon Auth: así los cambia la app con sus propias reglas.
- Todas las demás tablas que pertenecen a una persona referencian `profiles.user_id`.
- El rol `developer` se asigna a mano una sola vez (semilla con migración/script), nunca desde la UI.
- **Eliminar cuenta**: se borra el usuario en Neon Auth, el perfil pasa a `status = inactive`, `deleted_at = now()` y se vacían `full_name` ("Usuario eliminado"), `phone` y `avatar_url` (y el archivo de la foto). Sus reservas futuras se anulan y sus `push_devices` se borran.
- Las FK de las tablas de la app hacia `profiles` son `on delete restrict`: un perfil nunca se borra físicamente.

> Verificado en la Fase 3 (2026-10-04): `neon_auth.user.id` es `uuid`, así que `profiles.user_id` y todas las columnas que lo referencian también son `uuid`.

## 3. Tablas (`public`)

Convenciones: `id uuid` (default `gen_random_uuid()`), `created_at`/`updated_at timestamptz`, nombres en inglés y `snake_case`.

### `profiles`
| columna | tipo | notas |
|---|---|---|
| user_id | uuid PK, = neon_auth.user.id (sin FK, ver §2) | |
| full_name | text | |
| phone | text null | |
| avatar_url | text null | foto de perfil (almacenamiento: ver §11) |
| role | enum `developer \| admin \| coach \| client` | default `client` |
| is_coach | boolean | default `false`. `true` en todo `coach`; un `admin`/`developer` con `true` también imparte clases |
| status | enum `pending \| active \| inactive` | default `pending` |
| approved_at, deactivated_at, deleted_at | timestamptz null | `deleted_at` = cuenta eliminada y anonimizada |

Restricción `check`: `role = 'coach'` implica `is_coach = true`; `role = 'client'` implica `is_coach = false`.

### `gym_settings` (una sola fila)
| columna | tipo | default |
|---|---|---|
| id | smallint PK = 1 | |
| name | text | |
| timezone | text | `Europe/Madrid` |
| booking_window_days | int | 7 |
| cancel_deadline_minutes | int | 120 |
| reminder_minutes | int | 120 |

`name` y `timezone` solo los cambia el desarrollador; el resto, también el administrador.

### `class_types`
id, name, kind enum `group | individual`, duration_minutes, default_capacity, color, is_active.

### `schedule_slots` (plantilla semanal)
id, class_type_id → class_types, weekday (0 = lunes … 6), start_time (`time`, hora local del gimnasio), duration_minutes, capacity, coach_id → profiles null, valid_from `date`, valid_to `date null`, is_active.

### `sessions`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| class_type_id | FK → class_types | |
| slot_id | FK → schedule_slots null | null = sesión suelta |
| slot_date | date null | fecha de la ocurrencia de la plantilla que originó la sesión (no cambia aunque se mueva) |
| is_customized | boolean | default `false`; `true` si se editó a mano → los cambios de plantilla ya no la tocan |
| starts_at, ends_at | timestamptz | |
| capacity | int | |
| coach_id | FK → profiles null | |
| status | enum `scheduled \| cancelled` | |
| cancel_reason | text null | |

Único `(slot_id, slot_date)` para que generar sesiones desde la plantilla sea idempotente, aunque una sesión se haya movido de hora o cancelado (si se usara `starts_at`, mover una sesión haría que el generador la volviera a crear).

`coach_id` (aquí y en `schedule_slots`) debe ser un perfil con `is_coach = true`: lo valida la capa de datos (no se puede expresar con una FK).

### `bookings`
| columna | tipo | notas |
|---|---|---|
| id | uuid PK | |
| session_id | FK → sessions | |
| user_id | FK → profiles | |
| status | enum `confirmed \| waitlisted \| cancelled \| late_cancelled` | |
| attendance | enum `pending \| attended \| no_show` | default `pending` |
| created_by | FK → profiles | el propio cliente, un admin o el entrenador de una sesión individual |
| waitlisted_at | timestamptz null | orden de la lista de espera |
| cancelled_at | timestamptz null | |
| late_cancel_charged | boolean null | solo en `late_cancelled`: `null` = pendiente de decidir, `true` = se descuenta, `false` = no |
| late_cancel_decided_by | FK → profiles null | administrador que decidió |

Único parcial `(session_id, user_id) where status in ('confirmed','waitlisted')`: un cliente no puede tener dos reservas vivas en la misma sesión.

### `plans` (tarifas)
id, name, period enum `week | month | unlimited`, classes_per_period int null, is_active.

### `memberships` (tarifa asignada a un cliente)
id, user_id → profiles, plan_id → plans, starts_on `date`, ends_on `date null`. La vigente es la que cubre la fecha de la sesión. Historial completo. No puede haber dos tarifas solapadas para el mismo cliente: restricción de exclusión `exclude using gist (user_id with =, daterange(starts_on, ends_on, '[]') with &&)` (extensión `btree_gist`).

### `incidents`
id, title, description, priority enum `low | medium | high`, status enum `open | in_progress | closed`, user_id → profiles null (cliente afectado), session_id → sessions null, created_by → profiles, assigned_to → profiles null, closed_at.

### `announcements`
id, title, body, created_by → profiles, published_at.

### `push_devices`
id, user_id → profiles, platform enum `web | android | ios`, token text único, last_seen_at.

### `notifications` (registro de envíos, evita duplicados)
id, user_id, kind enum `reminder | waitlist_promoted | session_cancelled | account_approved | announcement`, ref_id uuid null (reserva, sesión o aviso), sent_at. Único `(user_id, kind, ref_id)`.

### Relaciones
```
neon_auth.user 1─1 profiles 1─* bookings *─1 sessions *─1 class_types
                    │  1─* memberships *─1 plans          │ *─1 schedule_slots *─1 class_types
                    │  1─* incidents (user / created_by / assigned_to)
                    │  1─* push_devices
                    └─ coach_id en sessions y schedule_slots (perfil con is_coach = true)
```

## 4. Reglas de negocio en el servidor

Todas en `lib/booking.ts` (funciones puras testeables) + una transacción en la capa de datos.

**Reservar** (transacción):
1. `SELECT … FROM sessions WHERE id = $1 FOR UPDATE` (bloquea la sesión → no hay sobreventa con reservas simultáneas).
2. Comprobar: perfil `active`, sesión `scheduled`, `now()` dentro de la ventana (`starts_at - booking_window_days` … `starts_at`), sin reserva viva previa.
3. Comprobar tarifa: debe existir una `membership` vigente en la fecha de la sesión; si el plan no es `unlimited`, las reservas `confirmed`, `late_cancelled` con `late_cancel_charged = true` y con `attendance = no_show` del periodo (semana de lunes a domingo o mes natural, calculados en la zona horaria del gimnasio) deben ser < `classes_per_period`.
4. Si hay plaza → `confirmed`; si no → `waitlisted` (sin consumir cupo).

**Anular**: si faltan ≥ `cancel_deadline_minutes` → `cancelled`; si no → `late_cancelled` con `late_cancel_charged = null` (pendiente). Un administrador decide después `true`/`false`; mientras sea `null` no descuenta. Después, **promover** de la lista de espera (misma transacción): el primer `waitlisted` por `waitlisted_at` cuya tarifa lo permita pasa a `confirmed` → notificación.

**Modificar** = anular + reservar la nueva sesión en una sola transacción; si la nueva falla, no se anula la antigua.

**Cancelar sesión** (admin): sesión `cancelled`, reservas vivas `cancelled` (sin consumir), notificación a afectados.

**Ampliar aforo** (admin): tras subir `capacity`, se promueve la lista de espera como al anular.

**Lista de espera caducada**: una reserva `waitlisted` de una sesión ya empezada se trata como caducada (no se muestra ni cuenta); no hace falta ningún proceso que la cambie.

**Baja de cliente** o **eliminación de cuenta**: sus reservas futuras pasan a `cancelled` (sin descontar) y se promueve la lista de espera de cada sesión afectada.

**Decidir anulación tardía** (admin): fija `late_cancel_charged` y `late_cancel_decided_by`. Si se descuenta y el cliente ya superaba su cupo del periodo, no se anula nada: solo cuenta para la próxima comprobación.

Los administradores pueden forzar una reserva (saltar aforo/cupo/ventana); queda `created_by` = admin. Un admin o desarrollador que reserva **para sí** también necesita tarifa vigente salvo que fuerce la reserva.

Un **entrenador** puede crear una sesión individual (`class_types.kind = individual`, aforo 1) con él mismo como `coach_id` y reservarla para un cliente activo; solo puede anular reservas de sesiones que imparte.

> Driver: las transacciones interactivas necesitan el `Pool` (WebSocket) de `@neondatabase/serverless`, no el driver HTTP. Se usa el Pool para escrituras con transacción y HTTP para lecturas simples.

## 5. Rutas (App Router)

Grupos de rutas para separar layouts por rol (los paréntesis no forman parte de la URL). UI en español, carpetas con la URL que verá el usuario.

```
app/
  (auth)/login                     Inicio de sesión
  (auth)/registro                  Registro
  (auth)/pendiente                 Alta pendiente de aprobación
  (client)/inicio                  Inicio del cliente
  (client)/calendario              Calendario
  (client)/calendario/[sessionId]  Detalle de sesión
  (client)/reservas                Mis reservas
  (client)/avisos                  Avisos
  (client)/perfil                  Perfil
  entrenador/                      Mi semana (cualquier perfil con is_coach) ?semana=AAAA-MM-DD (lunes)
  entrenador/dia/[date]            Clases que imparte ese día (AAAA-MM-DD)
  entrenador/sesiones/[sessionId]  Asistentes + marcar asistencia
  entrenador/incidencias           Incidencias que ha abierto (F9)
  entrenador/perfil                Perfil (mismo componente que /perfil, con la navegación del entrenador)
  admin/                           Hoy
  admin/agenda                     ?vista=dia|semana|mes&fecha=AAAA-MM-DD
  admin/sesiones/[sessionId]       Detalle de sesión
  admin/anulaciones                Anulaciones tardías pendientes de decidir
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
  admin/mas                        Menú "Más" en móvil: horario, tipos de clase, tarifas, avisos, ajustes, vista cliente
  offline                          Página sin conexión (la guarda el service worker, public/sw.js)
  privacidad                       Política de privacidad (pública, sin sesión; RGPD y tiendas)
  aviso-legal                      Aviso legal y condiciones de uso (pública, sin sesión; LSSI)
  api/auth/[...path]               Neon Auth
  api/cron/generate-sessions       Diario: crea sesiones de la plantilla (próximas 4 semanas)
  api/cron/reminders               Cada 15 min: recordatorios de clase (ver §11: requiere plan Pro o programador externo)
```

- `/` redirige: sin sesión → `/login`; cliente → `/inicio`, entrenador → `/entrenador`, admin/desarrollador → `/admin` (si además es entrenador, "Hoy" y "Más" enlazan a "Mi semana"). Hasta la Fase 3, `/` es el índice del prototipo.
- **Vista cliente** para admins: simplemente pueden abrir las rutas de `(client)`; el layout de admin tiene un enlace "Vista cliente" y viceversa.
- Mutaciones: **Server Actions** (en `app/**/actions.ts`), cada una valida con Zod y llama a la capa de datos.
- `api/cron/*` exige la cabecera `Authorization: Bearer $CRON_SECRET`.

## 6. Permisos

Dos capas (según la guía de autenticación de Next 16):
1. **`proxy.ts`** — comprobación optimista: sin cookie de sesión → `/login`. No consulta la base de datos.
2. **Capa de datos `lib/dal.ts`** (la que de verdad protege): `getCurrentUser()` (memorizada con `cache`) verifica la sesión de Neon Auth y carga `profiles`; `requireRole(...roles)`, `requireCoach()` y `requireActive()` lanzan/redirigen. Toda consulta usa el `user_id` de esa sesión. Un `user_id` que llegue del navegador solo se acepta en acciones de administrador, o de entrenador sobre una sesión que imparte, y siempre se comprueba ese permiso en el servidor.

| Acción | client | coach | admin | developer |
|---|:-:|:-:|:-:|:-:|
| Ver calendario y plazas libres | ✔ | ✔ | ✔ | ✔ |
| Reservar / anular **para sí** | ✔ (activo) | — | ✔ | ✔ |
| Ver mis reservas | ✔ | — | ✔ | ✔ |
| Ver asistentes de una sesión | — | solo las suyas | ✔ | ✔ |
| Crear sesión individual y apuntar a un cliente | — | solo como su entrenador | ✔ | ✔ |
| Marcar asistencia | — | solo las suyas | ✔ | ✔ |
| Reservar / anular **para otro**, forzar plaza | — | — | ✔ | ✔ |
| Crear / cancelar sesiones, horario, tipos | — | — | ✔ | ✔ |
| Clientes: aprobar, baja, tarifa | — | — | ✔ | ✔ |
| Tarifas | — | — | ✔ | ✔ |
| Incidencias: crear | — | ✔ | ✔ | ✔ |
| Incidencias: ver / gestionar | — | las suyas | ✔ | ✔ |
| Avisos: publicar | — | — | ✔ | ✔ |
| Ajustes: reglas de reserva | — | — | ✔ | ✔ |
| Ajustes técnicos: nombre, zona horaria | — | — | — | ✔ |
| Eliminar mi cuenta | ✔ | ✔ | ✔ | — |
| Decidir si una anulación tardía descuenta | — | — | ✔ | ✔ |
| Cambiar roles y marca de entrenador | — | — | — | ✔ |

La columna **coach** aplica a cualquier perfil con `is_coach = true` (también admins) para las sesiones donde es `coach_id`. Un entrenador que no es admin no ve datos de clientes fuera de las sesiones que imparte.

Usuario `pending` o `inactive`: solo `/pendiente` y `/perfil`.

## 7. Estructura de carpetas

```
app/            rutas (ver §5)
components/     UI (components/ui = shadcn)
db/schema.ts    esquema Drizzle
db/index.ts     cliente Drizzle (solo servidor: import 'server-only'): getDb() HTTP, getTxDb() Pool para transacciones
drizzle/        migraciones generadas (0000 extensiones y 0002 exclusión de memberships + fila de gym_settings son SQL a mano con --custom)
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
| bookings | `(cancelled_at) where status = 'late_cancelled' and late_cancel_charged is null` | anulaciones tardías pendientes |
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

> Límites de los planes gratuitos y decisiones derivadas (región, ramas de Neon, copias, uso comercial): `docs/LIMITS.md`.

- **Tareas programadas**: el plan gratuito (Hobby) de Vercel solo permite cron **una vez al día** (±59 min). `generate-sessions` cabe; `reminders` (cada 15 min) necesita **Vercel Pro** o un programador externo que llame a la ruta con `CRON_SECRET`. Propuesta (LIMITS D2): programador externo solo en horario del gimnasio (para no mantener despierto el cómputo de Neon) y ruta idempotente por ventana de tiempo. **Confirmado el 2026-10-05: cron-job.org** (más GitHub Actions de respaldo).

- **Fotos de perfil**: almacenamiento (Vercel Blob propuesto, R2 como alternativa) → Fase 5, al implementar F1. El límite de 4,5 MB por petición de Vercel y el cupo de Blob obligan a redimensionar en el cliente y subir directamente a Blob (LIMITS D7).
- **Push**: Web Push (PWA) y FCM/APNs vía Capacitor → Fase 8; la tabla `push_devices` sirve para ambos.
- **Sin conexión**: el service worker cachea "Mis reservas" (solo lectura) → Fase 2 (básico) y Fase 8. Al cerrar sesión o eliminar la cuenta se vacía la caché.
- **Textos legales**: `/privacidad` (RGPD arts. 13-14, LOPDGDD) y `/aviso-legal` (LSSI art. 10) ya existen, públicas y enlazadas desde login, registro, perfil y "Más". Los datos del titular viven en `lib/legal.ts` y están **pendientes hasta la Fase 7** (entre corchetes; las páginas muestran "Borrador" mientras falten). `proxy.ts` (Fase 3) debe dejarlas fuera de la protección por sesión. Si se añade un proveedor que trate datos personales (Sentry, Blob, push…), actualizar la lista de encargados de `/privacidad`. Las incidencias no deben contener datos de salud (RGPD art. 9). `/privacidad` afirma que los datos están en Fráncfort: depende de aplicar LIMITS D3 (Neon `aws-eu-central-1` y Vercel `fra1`) en la Fase 3; si cambia la región, cambiar el texto. Cualquier cambio de los textos legales actualiza `LEGAL.updatedAt`.

## 12. Historial de cambios

- 2026-10-04 · `profiles.user_id` y sus referencias pasan de `text` a `uuid`, el tipo real de `neon_auth.user.id`.
- 2026-10-04 · Esquema en `db/schema.ts` y migraciones iniciales. Restricciones `check` añadidas además de las de §3: valores positivos (aforos, duraciones, ventana de reserva), rangos de fechas válidos, `weekday` 0–6, `ends_at > starts_at`, `slot_id` y `slot_date` juntos, `waitlisted_at` obligatorio en lista de espera, decisión de anulación tardía solo en `late_cancelled` y cupo de tarifa coherente con el periodo. `notifications` único con `NULLS NOT DISTINCT` (los avisos sin `ref_id` tampoco se duplican). Índices extra en FK sin índice (`class_type_id`, `coach_id` de la plantilla, `plan_id`).

- 2026-10-04 · Rutas públicas `privacidad` y `aviso-legal`; datos del titular en `lib/legal.ts`.
- 2026-10-04 · Inicio por rol: `(client)/inicio`, `entrenador/` como "Mi semana" (`?semana=`), `entrenador/dia/[date]`, `entrenador/incidencias` y `entrenador/perfil`; `/` lleva a `/login` sin sesión.
- 2026-10-02 · Versión inicial aprobada. Revisión final: sin FK a `neon_auth` y perfiles anonimizados (eliminación de cuenta), `slot_date` + `is_customized` para que mover sesiones no las duplique, `check` de rol/entrenador, tarifas sin solapes, reglas de baja / ampliar aforo / lista de espera caducada, permisos del entrenador en sesiones individuales, reparto de ajustes admin/desarrollador y límite de cron de Vercel Hobby.
