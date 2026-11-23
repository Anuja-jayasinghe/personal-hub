CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"device_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_ok_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscriptions_recipient_check" CHECK ("push_subscriptions"."recipient" = lower("push_subscriptions"."recipient") and length("push_subscriptions"."recipient") between 3 and 320),
	CONSTRAINT "push_subscriptions_endpoint_check" CHECK ("push_subscriptions"."endpoint" like 'https://%' and length("push_subscriptions"."endpoint") <= 1024),
	CONSTRAINT "push_subscriptions_p256dh_check" CHECK ("push_subscriptions"."p256dh" ~ '^[A-Za-z0-9_-]{80,100}$'),
	CONSTRAINT "push_subscriptions_auth_check" CHECK ("push_subscriptions"."auth" ~ '^[A-Za-z0-9_-]{16,32}$'),
	CONSTRAINT "push_subscriptions_device_label_check" CHECK (length("push_subscriptions"."device_label") between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "push_subscriptions_recipient_idx" ON "push_subscriptions" USING btree ("recipient");