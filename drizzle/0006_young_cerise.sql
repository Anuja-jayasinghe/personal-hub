CREATE TABLE "electricity_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"bill_date" date NOT NULL,
	"reading_date" date NOT NULL,
	"previous_reading" numeric(12, 2) NOT NULL,
	"current_reading" numeric(12, 2) NOT NULL,
	"units" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2),
	"due_date" date,
	"paid_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "electricity_bills_readings_check" CHECK ("electricity_bills"."previous_reading" >= 0 and "electricity_bills"."current_reading" >= 0),
	CONSTRAINT "electricity_bills_units_check" CHECK ("electricity_bills"."units" >= 0),
	CONSTRAINT "electricity_bills_amount_check" CHECK ("electricity_bills"."amount" is null or "electricity_bills"."amount" >= 0),
	CONSTRAINT "electricity_bills_due_check" CHECK ("electricity_bills"."due_date" is null or "electricity_bills"."due_date" >= "electricity_bills"."bill_date")
);
--> statement-breakpoint
ALTER TABLE "electricity_bills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electricity_bills" ADD CONSTRAINT "electricity_bills_meter_id_electricity_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."electricity_meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "electricity_bills_meter_date_idx" ON "electricity_bills" USING btree ("meter_id","bill_date");