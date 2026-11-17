-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('created', 'preview_generating', 'preview_ready', 'paid', 'generating', 'review', 'delivered', 'expired', 'needs_help', 'refunded');

-- CreateEnum
CREATE TYPE "EventActor" AS ENUM ('system', 'admin', 'customer');

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'created',
    "tariff" TEXT NOT NULL,
    "amount_rub" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "room_photo_key" TEXT,
    "artifacts" JSONB NOT NULL DEFAULT '{}',
    "inputs" JSONB NOT NULL DEFAULT '{}',
    "preview_regens" INTEGER NOT NULL DEFAULT 0,
    "share_token" TEXT NOT NULL,
    "payment_id" TEXT,
    "payment_provider" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "ip_hash" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" BIGSERIAL NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "actor" "EventActor" NOT NULL DEFAULT 'system',
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "amount_rub" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "refunded_rub" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "key" TEXT NOT NULL,
    "order_id" UUID,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_share_token_key" ON "orders"("share_token");

-- CreateIndex
CREATE UNIQUE INDEX "orders_payment_id_key" ON "orders"("payment_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_email_created_at_idx" ON "orders"("email", "created_at");

-- CreateIndex
CREATE INDEX "orders_ip_hash_created_at_idx" ON "orders"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "uploads_order_id_created_at_idx" ON "uploads"("order_id", "created_at");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
