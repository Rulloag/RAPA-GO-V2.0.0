CREATE TABLE "wallet_transactions_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ride_id" uuid,
	"payment_id" uuid,
	"applied_to_ride_id" uuid,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"amount_clp" integer NOT NULL,
	"currency" text DEFAULT 'CLP' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approval_status" text DEFAULT 'not_required' NOT NULL,
	"idempotency_key" text NOT NULL,
	"policy_version" text NOT NULL,
	"actor_role" text NOT NULL,
	"collection_method" text,
	"reversal_of_transaction_id" uuid,
	"settles_transaction_id" uuid,
	"created_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"reversed_at" timestamp with time zone,
	"metadata" jsonb,
	CONSTRAINT "wallet_transactions_ledger_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "wallet_transactions_ledger_amount_positive" CHECK ("wallet_transactions_ledger"."amount_clp" > 0)
);
--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_ride_id_ride_requests_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_applied_to_ride_id_ride_requests_id_fk" FOREIGN KEY ("applied_to_ride_id") REFERENCES "public"."ride_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_reversal_of_transaction_id_wallet_transactions_ledger_id_fk" FOREIGN KEY ("reversal_of_transaction_id") REFERENCES "public"."wallet_transactions_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_settles_transaction_id_wallet_transactions_ledger_id_fk" FOREIGN KEY ("settles_transaction_id") REFERENCES "public"."wallet_transactions_ledger"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions_ledger" ADD CONSTRAINT "wallet_transactions_ledger_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_wallet_tx_ledger_user_id" ON "wallet_transactions_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_tx_ledger_wallet_id" ON "wallet_transactions_ledger" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_tx_ledger_status" ON "wallet_transactions_ledger" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_wallet_tx_ledger_ride_id" ON "wallet_transactions_ledger" USING btree ("ride_id");--> statement-breakpoint
CREATE INDEX "idx_wallet_tx_ledger_type_status" ON "wallet_transactions_ledger" USING btree ("type","status");