CREATE TABLE "access_grants" (
	"person_id" uuid NOT NULL,
	"area" text NOT NULL,
	"level" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "access_grants_person_id_area_pk" PRIMARY KEY("person_id","area"),
	CONSTRAINT "access_grants_level_check" CHECK ("access_grants"."level" in ('see', 'add', 'edit'))
);
--> statement-breakpoint
ALTER TABLE "access_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_email_unique" UNIQUE("email"),
	CONSTRAINT "people_status_check" CHECK ("people"."status" in ('pending', 'active', 'blocked')),
	CONSTRAINT "people_email_check" CHECK ("people"."email" = lower("people"."email"))
);
--> statement-breakpoint
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_grants_person_idx" ON "access_grants" USING btree ("person_id");