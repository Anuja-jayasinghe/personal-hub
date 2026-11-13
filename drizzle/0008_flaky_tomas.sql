CREATE TABLE "bill_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"paid_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_payments_amount_check" CHECK ("bill_payments"."amount" is null or "bill_payments"."amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bill_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_item_id_bill_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."bill_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_payments_item_idx" ON "bill_payments" USING btree ("item_id","paid_date");