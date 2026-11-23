CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "notifications_channel_check" CHECK ("notifications"."channel" in ('email', 'push')),
	CONSTRAINT "notifications_status_check" CHECK ("notifications"."status" in ('dry_run', 'pending', 'sent', 'failed')),
	CONSTRAINT "notifications_recipient_check" CHECK ("notifications"."recipient" = lower("notifications"."recipient")),
	CONSTRAINT "notifications_sent_at_check" CHECK ("notifications"."status" <> 'sent' or "notifications"."sent_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_real_once" ON "notifications" USING btree ("recipient","dedupe_key") WHERE "notifications"."status" <> 'dry_run';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dry_run_once" ON "notifications" USING btree ("recipient","dedupe_key") WHERE "notifications"."status" = 'dry_run';--> statement-breakpoint
CREATE INDEX "notifications_recent_idx" ON "notifications" USING btree ("created_at" DESC NULLS LAST);