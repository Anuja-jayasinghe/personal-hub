CREATE TABLE "cheques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_party" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"bank" text,
	"cheque_number" text,
	"cheque_date" date NOT NULL,
	"note" text,
	"status" text DEFAULT 'waiting' NOT NULL,
	"deposited_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cheques_status_check" CHECK ("cheques"."status" in ('waiting', 'deposited', 'cleared', 'bounced', 'cancelled')),
	CONSTRAINT "cheques_amount_check" CHECK ("cheques"."amount" > 0),
	CONSTRAINT "cheques_from_check" CHECK (char_length("cheques"."from_party") between 1 and 80),
	CONSTRAINT "cheques_deposit_date_check" CHECK ("cheques"."status" <> 'waiting' or "cheques"."deposited_on" is null),
	CONSTRAINT "cheques_deposited_has_date_check" CHECK ("cheques"."status" not in ('deposited', 'cleared') or "cheques"."deposited_on" is not null)
);
--> statement-breakpoint
ALTER TABLE "cheques" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "cheques_status_date_idx" ON "cheques" USING btree ("status","cheque_date");