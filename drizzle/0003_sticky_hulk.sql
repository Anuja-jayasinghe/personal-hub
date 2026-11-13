CREATE TABLE "vehicle_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"service_date" date NOT NULL,
	"service_type" text NOT NULL,
	"garage" text,
	"odometer_km" integer,
	"cost" numeric(12, 2),
	"items_done" text,
	"next_due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicle_services_odometer_check" CHECK ("vehicle_services"."odometer_km" is null or "vehicle_services"."odometer_km" >= 0),
	CONSTRAINT "vehicle_services_cost_check" CHECK ("vehicle_services"."cost" is null or "vehicle_services"."cost" >= 0),
	CONSTRAINT "vehicle_services_next_due_check" CHECK ("vehicle_services"."next_due_date" is null or "vehicle_services"."next_due_date" >= "vehicle_services"."service_date")
);
--> statement-breakpoint
ALTER TABLE "vehicle_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicle_services" ADD CONSTRAINT "vehicle_services_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicle_services_vehicle_date_idx" ON "vehicle_services" USING btree ("vehicle_id","service_date");