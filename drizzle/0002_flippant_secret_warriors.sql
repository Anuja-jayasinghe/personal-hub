CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nickname" text NOT NULL,
	"registration_number" text,
	"make" text,
	"model" text,
	"year" integer,
	"fuel_type" text,
	"odometer_km" integer,
	"cover_attachment_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_year_check" CHECK ("vehicles"."year" is null or "vehicles"."year" between 1886 and 2100),
	CONSTRAINT "vehicles_odometer_check" CHECK ("vehicles"."odometer_km" is null or "vehicles"."odometer_km" >= 0)
);
--> statement-breakpoint
ALTER TABLE "vehicles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_cover_attachment_id_attachments_id_fk" FOREIGN KEY ("cover_attachment_id") REFERENCES "public"."attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vehicles_archived_idx" ON "vehicles" USING btree ("archived_at");