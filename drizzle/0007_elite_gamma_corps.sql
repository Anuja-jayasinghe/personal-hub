CREATE TABLE "bill_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'bill' NOT NULL,
	"name" text NOT NULL,
	"frequency" text NOT NULL,
	"next_due_date" date,
	"anchor_day" smallint,
	"amount" numeric(12, 2),
	"autopay" boolean DEFAULT false NOT NULL,
	"payment_method" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_items_kind_check" CHECK ("bill_items"."kind" in ('bill', 'subscription')),
	CONSTRAINT "bill_items_frequency_check" CHECK ("bill_items"."frequency" in ('weekly', 'monthly', 'quarterly', 'yearly', 'one_off')),
	CONSTRAINT "bill_items_anchor_day_check" CHECK ("bill_items"."anchor_day" is null or "bill_items"."anchor_day" between 1 and 31),
	CONSTRAINT "bill_items_amount_check" CHECK ("bill_items"."amount" is null or "bill_items"."amount" >= 0),
	CONSTRAINT "bill_items_due_check" CHECK ("bill_items"."frequency" = 'one_off' or "bill_items"."next_due_date" is not null)
);
--> statement-breakpoint
ALTER TABLE "bill_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "bill_items_archived_idx" ON "bill_items" USING btree ("archived_at");