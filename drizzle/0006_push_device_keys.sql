ALTER TABLE "push_devices" ADD COLUMN "p256dh" text;--> statement-breakpoint
ALTER TABLE "push_devices" ADD COLUMN "auth" text;--> statement-breakpoint
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_web_keys" CHECK ("push_devices"."platform" <> 'web' or ("push_devices"."p256dh" is not null and "push_devices"."auth" is not null));