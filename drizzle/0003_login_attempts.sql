CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "login_attempts_failures_positive" CHECK ("login_attempts"."failures" > 0)
);
--> statement-breakpoint
CREATE INDEX "login_attempts_window_started_at_idx" ON "login_attempts" USING btree ("window_started_at");