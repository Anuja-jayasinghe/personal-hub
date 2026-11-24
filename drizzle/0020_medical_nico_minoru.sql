ALTER TABLE "people" DROP CONSTRAINT "people_status_check";--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invited_by" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "inviter_name" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invite_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invite_opened_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "invite_send_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "people_invite_code_idx" ON "people" USING btree ("invite_code") WHERE "people"."invite_code" is not null;--> statement-breakpoint
CREATE INDEX "people_status_idx" ON "people" USING btree ("status");--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_status_check" CHECK ("people"."status" in ('pending', 'active', 'blocked', 'invited', 'expired'));