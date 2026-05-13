CREATE TABLE "user_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_holder_name" varchar(150) NOT NULL,
	"bank_name" varchar(100) NOT NULL,
	"account_type" varchar(50) NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"account_number_encrypted" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_bank_account" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;