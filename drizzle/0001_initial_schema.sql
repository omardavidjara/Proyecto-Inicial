CREATE TYPE "public"."attendance" AS ENUM('pending', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'waitlisted', 'cancelled', 'late_cancelled');--> statement-breakpoint
CREATE TYPE "public"."class_kind" AS ENUM('group', 'individual');--> statement-breakpoint
CREATE TYPE "public"."incident_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('reminder', 'waitlist_promoted', 'session_cancelled', 'account_approved', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."plan_period" AS ENUM('week', 'month', 'unlimited');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('web', 'android', 'ios');--> statement-breakpoint
CREATE TYPE "public"."profile_status" AS ENUM('pending', 'active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('developer', 'admin', 'coach', 'client');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "booking_status" NOT NULL,
	"attendance" "attendance" DEFAULT 'pending' NOT NULL,
	"created_by" uuid NOT NULL,
	"waitlisted_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"late_cancel_charged" boolean,
	"late_cancel_decided_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_waitlisted_at_when_waitlisted" CHECK ("bookings"."status" <> 'waitlisted' or "bookings"."waitlisted_at" is not null),
	CONSTRAINT "bookings_late_cancel_only_when_late" CHECK ("bookings"."status" = 'late_cancelled' or ("bookings"."late_cancel_charged" is null and "bookings"."late_cancel_decided_by" is null))
);
--> statement-breakpoint
CREATE TABLE "class_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"kind" "class_kind" DEFAULT 'group' NOT NULL,
	"duration_minutes" integer NOT NULL,
	"default_capacity" integer NOT NULL,
	"color" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_types_duration_positive" CHECK ("class_types"."duration_minutes" > 0),
	CONSTRAINT "class_types_capacity_positive" CHECK ("class_types"."default_capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "gym_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Madrid' NOT NULL,
	"booking_window_days" integer DEFAULT 7 NOT NULL,
	"cancel_deadline_minutes" integer DEFAULT 120 NOT NULL,
	"reminder_minutes" integer DEFAULT 120 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gym_settings_single_row" CHECK ("gym_settings"."id" = 1),
	CONSTRAINT "gym_settings_booking_window_positive" CHECK ("gym_settings"."booking_window_days" > 0),
	CONSTRAINT "gym_settings_cancel_deadline_non_negative" CHECK ("gym_settings"."cancel_deadline_minutes" >= 0),
	CONSTRAINT "gym_settings_reminder_non_negative" CHECK ("gym_settings"."reminder_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" "incident_priority" DEFAULT 'medium' NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"user_id" uuid,
	"session_id" uuid,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_valid_range" CHECK ("memberships"."ends_on" is null or "memberships"."ends_on" >= "memberships"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"ref_id" uuid,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_once_uq" UNIQUE NULLS NOT DISTINCT("user_id","kind","ref_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"period" "plan_period" NOT NULL,
	"classes_per_period" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_classes_per_period_matches_period" CHECK (("plans"."period" = 'unlimited' and "plans"."classes_per_period" is null) or ("plans"."period" <> 'unlimited' and "plans"."classes_per_period" is not null and "plans"."classes_per_period" > 0))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"avatar_url" text,
	"role" "role" DEFAULT 'client' NOT NULL,
	"is_coach" boolean DEFAULT false NOT NULL,
	"status" "profile_status" DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"deactivated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_coach_is_coach" CHECK ("profiles"."role" <> 'coach' or "profiles"."is_coach"),
	CONSTRAINT "profiles_client_not_coach" CHECK ("profiles"."role" <> 'client' or not "profiles"."is_coach")
);
--> statement-breakpoint
CREATE TABLE "push_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"token" text NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_devices_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_type_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_time" time NOT NULL,
	"duration_minutes" integer NOT NULL,
	"capacity" integer NOT NULL,
	"coach_id" uuid,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_slots_weekday_range" CHECK ("schedule_slots"."weekday" between 0 and 6),
	CONSTRAINT "schedule_slots_duration_positive" CHECK ("schedule_slots"."duration_minutes" > 0),
	CONSTRAINT "schedule_slots_capacity_positive" CHECK ("schedule_slots"."capacity" > 0),
	CONSTRAINT "schedule_slots_valid_range" CHECK ("schedule_slots"."valid_to" is null or "schedule_slots"."valid_to" >= "schedule_slots"."valid_from")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_type_id" uuid NOT NULL,
	"slot_id" uuid,
	"slot_date" date,
	"is_customized" boolean DEFAULT false NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"coach_id" uuid,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_ends_after_starts" CHECK ("sessions"."ends_at" > "sessions"."starts_at"),
	CONSTRAINT "sessions_capacity_positive" CHECK ("sessions"."capacity" > 0),
	CONSTRAINT "sessions_slot_date_with_slot" CHECK (("sessions"."slot_id" is null) = ("sessions"."slot_date" is null))
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_late_cancel_decided_by_profiles_user_id_fk" FOREIGN KEY ("late_cancel_decided_by") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_profiles_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_coach_id_profiles_user_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_class_type_id_class_types_id_fk" FOREIGN KEY ("class_type_id") REFERENCES "public"."class_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_slot_id_schedule_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."schedule_slots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_coach_id_profiles_user_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_published_at_idx" ON "announcements" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_live_per_user_uq" ON "bookings" USING btree ("session_id","user_id") WHERE "bookings"."status" in ('confirmed', 'waitlisted');--> statement-breakpoint
CREATE INDEX "bookings_session_status_idx" ON "bookings" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "bookings_waitlist_idx" ON "bookings" USING btree ("session_id","waitlisted_at") WHERE "bookings"."status" = 'waitlisted';--> statement-breakpoint
CREATE INDEX "bookings_user_created_at_idx" ON "bookings" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookings_late_cancel_pending_idx" ON "bookings" USING btree ("cancelled_at") WHERE "bookings"."status" = 'late_cancelled' and "bookings"."late_cancel_charged" is null;--> statement-breakpoint
CREATE INDEX "incidents_status_created_at_idx" ON "incidents" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "incidents_user_idx" ON "incidents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "incidents_session_idx" ON "incidents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "memberships_user_starts_on_idx" ON "memberships" USING btree ("user_id","starts_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "memberships_plan_idx" ON "memberships" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "profiles_status_role_idx" ON "profiles" USING btree ("status","role");--> statement-breakpoint
CREATE INDEX "profiles_full_name_trgm_idx" ON "profiles" USING gin ("full_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "push_devices_user_idx" ON "push_devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "schedule_slots_class_type_idx" ON "schedule_slots" USING btree ("class_type_id");--> statement-breakpoint
CREATE INDEX "schedule_slots_coach_idx" ON "schedule_slots" USING btree ("coach_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_slot_occurrence_uq" ON "sessions" USING btree ("slot_id","slot_date");--> statement-breakpoint
CREATE INDEX "sessions_starts_at_idx" ON "sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sessions_coach_starts_at_idx" ON "sessions" USING btree ("coach_id","starts_at");--> statement-breakpoint
CREATE INDEX "sessions_class_type_idx" ON "sessions" USING btree ("class_type_id");