CREATE TABLE "vehicle_renewals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text,
	"reference_number" text,
	"start_date" date,
	"expiry_date" date NOT NULL,
	"amount" numeric(12, 2),
	"renewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_renewals_amount_check" CHECK ("vehicle_renewals"."amount" is null or "vehicle_renewals"."amount" >= 0),
	CONSTRAINT "vehicle_renewals_dates_check" CHECK ("vehicle_renewals"."start_date" is null or "vehicle_renewals"."start_date" <= "vehicle_renewals"."expiry_date")
);
--> statement-breakpoint
ALTER TABLE "vehicle_renewals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_renewals" ADD CONSTRAINT "vehicle_renewals_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_renewals_vehicle_expiry_idx" ON "vehicle_renewals" USING btree ("vehicle_id","expiry_date");