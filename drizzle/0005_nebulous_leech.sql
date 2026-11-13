CREATE TABLE "electricity_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"notes" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "electricity_meters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "electricity_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"reading_date" date NOT NULL,
	"value" numeric(12, 2) NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"note" text,
	"replaced_final_value" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "electricity_readings_value_check" CHECK ("electricity_readings"."value" >= 0),
	CONSTRAINT "electricity_readings_replaced_check" CHECK ("electricity_readings"."replaced_final_value" is null or "electricity_readings"."replaced_final_value" >= 0),
	CONSTRAINT "electricity_readings_source_check" CHECK ("electricity_readings"."source" in ('manual', 'auto'))
);
--> statement-breakpoint
ALTER TABLE "electricity_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electricity_readings" ADD CONSTRAINT "electricity_readings_meter_id_electricity_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."electricity_meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "electricity_meters_archived_idx" ON "electricity_meters" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "electricity_readings_meter_date_idx" ON "electricity_readings" USING btree ("meter_id","reading_date");