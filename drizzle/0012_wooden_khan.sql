CREATE TABLE "electricity_live_switches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"switched_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "electricity_live_switches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "electricity_live_switches" ADD CONSTRAINT "electricity_live_switches_meter_id_electricity_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."electricity_meters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "electricity_live_switches_date_idx" ON "electricity_live_switches" USING btree ("switched_on");