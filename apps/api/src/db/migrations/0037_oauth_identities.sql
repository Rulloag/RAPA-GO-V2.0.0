CREATE TABLE "oauth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(30) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_email" varchar(255),
	"provider_email_verified" boolean DEFAULT false NOT NULL,
	"provider_is_private_email" boolean DEFAULT false NOT NULL,
	"encrypted_refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_oauth_identities_provider_user" UNIQUE("provider","provider_user_id"),
	CONSTRAINT "chk_oauth_identities_provider" CHECK ("oauth_identities"."provider" IN ('apple'))
);
--> statement-breakpoint
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_oauth_identities_user_id" ON "oauth_identities" USING btree ("user_id");
