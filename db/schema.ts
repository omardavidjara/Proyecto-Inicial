// Esquema de la app en el esquema `public` de Neon (docs/ARCHITECTURE.md §3 y §8).
// `neon_auth` lo gestiona Neon Auth: no se declara aquí ni se le ponen FK (ARCHITECTURE §2).
// Cambios: editar este archivo y `npm run db:generate`. Lo que drizzle-kit no sabe expresar
// (extensiones, restricción de exclusión de `memberships`, fila de `gym_settings`) vive en
// migraciones personalizadas de `drizzle/` (`drizzle-kit generate --custom`).
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ── Columnas comunes ──────────────────────────────────────────────────────────

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const timestamps = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const id = () => uuid("id").primaryKey().defaultRandom();

// ── Enumerados ────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ["developer", "admin", "coach", "client"]);
export const profileStatusEnum = pgEnum("profile_status", ["pending", "active", "inactive"]);
export const classKindEnum = pgEnum("class_kind", ["group", "individual"]);
export const sessionStatusEnum = pgEnum("session_status", ["scheduled", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "confirmed",
  "waitlisted",
  "cancelled",
  "late_cancelled",
]);
export const attendanceEnum = pgEnum("attendance", ["pending", "attended", "no_show"]);
export const planPeriodEnum = pgEnum("plan_period", ["week", "month", "unlimited"]);
export const incidentPriorityEnum = pgEnum("incident_priority", ["low", "medium", "high"]);
export const incidentStatusEnum = pgEnum("incident_status", ["open", "in_progress", "closed"]);
export const platformEnum = pgEnum("platform", ["web", "android", "ios"]);
export const notificationKindEnum = pgEnum("notification_kind", [
  "reminder",
  "waitlist_promoted",
  "session_cancelled",
  "account_approved",
  "announcement",
]);

// ── Personas ──────────────────────────────────────────────────────────────────

export const profiles = pgTable(
  "profiles",
  {
    // = neon_auth.user.id (uuid), sin FK (el perfil sobrevive anonimizado a la cuenta)
    userId: uuid("user_id").primaryKey(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    role: roleEnum("role").notNull().default("client"),
    isCoach: boolean("is_coach").notNull().default(false),
    status: profileStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamptz("approved_at"),
    deactivatedAt: timestamptz("deactivated_at"),
    deletedAt: timestamptz("deleted_at"),
    ...timestamps,
  },
  (t) => [
    check("profiles_coach_is_coach", sql`${t.role} <> 'coach' or ${t.isCoach}`),
    check("profiles_client_not_coach", sql`${t.role} <> 'client' or not ${t.isCoach}`),
    index("profiles_status_role_idx").on(t.status, t.role),
    index("profiles_full_name_trgm_idx").using("gin", sql`${t.fullName} gin_trgm_ops`),
  ],
);

// ── Ajustes (una sola fila, id = 1) ───────────────────────────────────────────

export const gymSettings = pgTable(
  "gym_settings",
  {
    id: smallint("id").primaryKey().default(1),
    name: text("name").notNull(),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    bookingWindowDays: integer("booking_window_days").notNull().default(7),
    cancelDeadlineMinutes: integer("cancel_deadline_minutes").notNull().default(120),
    reminderMinutes: integer("reminder_minutes").notNull().default(120),
    ...timestamps,
  },
  (t) => [
    check("gym_settings_single_row", sql`${t.id} = 1`),
    check("gym_settings_booking_window_positive", sql`${t.bookingWindowDays} > 0`),
    check("gym_settings_cancel_deadline_non_negative", sql`${t.cancelDeadlineMinutes} >= 0`),
    check("gym_settings_reminder_non_negative", sql`${t.reminderMinutes} >= 0`),
  ],
);

// ── Clases y horario ──────────────────────────────────────────────────────────

export const classTypes = pgTable(
  "class_types",
  {
    id: id(),
    name: text("name").notNull(),
    kind: classKindEnum("kind").notNull().default("group"),
    durationMinutes: integer("duration_minutes").notNull(),
    defaultCapacity: integer("default_capacity").notNull(),
    color: text("color").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("class_types_duration_positive", sql`${t.durationMinutes} > 0`),
    check("class_types_capacity_positive", sql`${t.defaultCapacity} > 0`),
  ],
);

export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: id(),
    classTypeId: uuid("class_type_id")
      .notNull()
      .references(() => classTypes.id, { onDelete: "restrict" }),
    weekday: smallint("weekday").notNull(), // 0 = lunes … 6 = domingo
    startTime: time("start_time").notNull(), // hora local del gimnasio
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull(),
    coachId: uuid("coach_id").references(() => profiles.userId, { onDelete: "restrict" }),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("schedule_slots_weekday_range", sql`${t.weekday} between 0 and 6`),
    check("schedule_slots_duration_positive", sql`${t.durationMinutes} > 0`),
    check("schedule_slots_capacity_positive", sql`${t.capacity} > 0`),
    check("schedule_slots_valid_range", sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
    index("schedule_slots_class_type_idx").on(t.classTypeId),
    index("schedule_slots_coach_idx").on(t.coachId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    classTypeId: uuid("class_type_id")
      .notNull()
      .references(() => classTypes.id, { onDelete: "restrict" }),
    slotId: uuid("slot_id").references(() => scheduleSlots.id, { onDelete: "restrict" }),
    slotDate: date("slot_date"),
    isCustomized: boolean("is_customized").notNull().default(false),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    capacity: integer("capacity").notNull(),
    coachId: uuid("coach_id").references(() => profiles.userId, { onDelete: "restrict" }),
    status: sessionStatusEnum("status").notNull().default("scheduled"),
    cancelReason: text("cancel_reason"),
    ...timestamps,
  },
  (t) => [
    check("sessions_ends_after_starts", sql`${t.endsAt} > ${t.startsAt}`),
    check("sessions_capacity_positive", sql`${t.capacity} > 0`),
    check("sessions_slot_date_with_slot", sql`(${t.slotId} is null) = (${t.slotDate} is null)`),
    // Generar desde la plantilla es idempotente aunque la sesión se mueva o se cancele
    uniqueIndex("sessions_slot_occurrence_uq").on(t.slotId, t.slotDate),
    index("sessions_starts_at_idx").on(t.startsAt),
    index("sessions_coach_starts_at_idx").on(t.coachId, t.startsAt),
    index("sessions_class_type_idx").on(t.classTypeId),
  ],
);

// ── Reservas ──────────────────────────────────────────────────────────────────

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    status: bookingStatusEnum("status").notNull(),
    attendance: attendanceEnum("attendance").notNull().default("pending"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    waitlistedAt: timestamptz("waitlisted_at"),
    cancelledAt: timestamptz("cancelled_at"),
    lateCancelCharged: boolean("late_cancel_charged"),
    lateCancelDecidedBy: uuid("late_cancel_decided_by").references(() => profiles.userId, {
      onDelete: "restrict",
    }),
    ...timestamps,
  },
  (t) => [
    check(
      "bookings_waitlisted_at_when_waitlisted",
      sql`${t.status} <> 'waitlisted' or ${t.waitlistedAt} is not null`,
    ),
    check(
      "bookings_late_cancel_only_when_late",
      sql`${t.status} = 'late_cancelled' or (${t.lateCancelCharged} is null and ${t.lateCancelDecidedBy} is null)`,
    ),
    // Un cliente no puede tener dos reservas vivas en la misma sesión
    uniqueIndex("bookings_live_per_user_uq")
      .on(t.sessionId, t.userId)
      .where(sql`${t.status} in ('confirmed', 'waitlisted')`),
    index("bookings_session_status_idx").on(t.sessionId, t.status),
    index("bookings_waitlist_idx")
      .on(t.sessionId, t.waitlistedAt)
      .where(sql`${t.status} = 'waitlisted'`),
    index("bookings_user_created_at_idx").on(t.userId, t.createdAt.desc()),
    index("bookings_late_cancel_pending_idx")
      .on(t.cancelledAt)
      .where(sql`${t.status} = 'late_cancelled' and ${t.lateCancelCharged} is null`),
  ],
);

// ── Tarifas ───────────────────────────────────────────────────────────────────

export const plans = pgTable(
  "plans",
  {
    id: id(),
    name: text("name").notNull(),
    period: planPeriodEnum("period").notNull(),
    classesPerPeriod: integer("classes_per_period"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    // Ilimitada: sin cupo; semanal o mensual: cupo positivo (con "is not null": un CHECK con NULL pasa)
    check(
      "plans_classes_per_period_matches_period",
      sql`(${t.period} = 'unlimited' and ${t.classesPerPeriod} is null) or (${t.period} <> 'unlimited' and ${t.classesPerPeriod} is not null and ${t.classesPerPeriod} > 0)`,
    ),
  ],
);

// Sin solapes por cliente: restricción de exclusión (btree_gist) en una migración personalizada
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    ...timestamps,
  },
  (t) => [
    check("memberships_valid_range", sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`),
    index("memberships_user_starts_on_idx").on(t.userId, t.startsOn.desc()),
    index("memberships_plan_idx").on(t.planId),
  ],
);

// ── Incidencias y avisos ──────────────────────────────────────────────────────

export const incidents = pgTable(
  "incidents",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    priority: incidentPriorityEnum("priority").notNull().default("medium"),
    status: incidentStatusEnum("status").notNull().default("open"),
    userId: uuid("user_id").references(() => profiles.userId, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "restrict" }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    assignedTo: uuid("assigned_to").references(() => profiles.userId, { onDelete: "restrict" }),
    closedAt: timestamptz("closed_at"),
    ...timestamps,
  },
  (t) => [
    index("incidents_status_created_at_idx").on(t.status, t.createdAt.desc()),
    index("incidents_user_idx").on(t.userId),
    index("incidents_session_idx").on(t.sessionId),
  ],
);

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    publishedAt: timestamptz("published_at").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("announcements_published_at_idx").on(t.publishedAt.desc())],
);

// ── Notificaciones ────────────────────────────────────────────────────────────

export const pushDevices = pgTable(
  "push_devices",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    platform: platformEnum("platform").notNull(),
    token: text("token").notNull().unique(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index("push_devices_user_idx").on(t.userId)],
);

// Registro de envíos: el único evita avisos duplicados aunque el programador se ejecute dos veces
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "restrict" }),
    kind: notificationKindEnum("kind").notNull(),
    refId: uuid("ref_id"),
    sentAt: timestamptz("sent_at").notNull().defaultNow(),
  },
  (t) => [
    // NULLS NOT DISTINCT: "cuenta aprobada" (sin ref_id) tampoco se envía dos veces
    unique("notifications_once_uq").on(t.userId, t.kind, t.refId).nullsNotDistinct(),
  ],
);
