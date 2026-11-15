CREATE TABLE "vehicle_odometer_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"reading_date" date NOT NULL,
	"km" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_odometer_km_check" CHECK ("vehicle_odometer_readings"."km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vehicle_odometer_readings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_odometer_readings" ADD CONSTRAINT "vehicle_odometer_readings_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_odometer_vehicle_idx" ON "vehicle_odometer_readings" USING btree ("vehicle_id","reading_date");