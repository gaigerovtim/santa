-- Номер счёта для Robokassa: целое, уникальное, выдаётся автоматически.
ALTER TABLE "payments" ADD COLUMN "inv_id" SERIAL NOT NULL;
CREATE UNIQUE INDEX "payments_inv_id_key" ON "payments"("inv_id");
