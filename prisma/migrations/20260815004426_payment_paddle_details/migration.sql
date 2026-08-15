-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "country" TEXT;
ALTER TABLE "Customer" ADD COLUMN "locale" TEXT;
ALTER TABLE "Customer" ADD COLUMN "rawJson" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "billedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cardBrand" TEXT;
ALTER TABLE "Payment" ADD COLUMN "cardLast4" TEXT;
ALTER TABLE "Payment" ADD COLUMN "collectionMode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "customerCountry" TEXT;
ALTER TABLE "Payment" ADD COLUMN "discount" TEXT;
ALTER TABLE "Payment" ADD COLUMN "earnings" TEXT;
ALTER TABLE "Payment" ADD COLUMN "failureCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "failureReason" TEXT;
ALTER TABLE "Payment" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN "lastEventType" TEXT;
ALTER TABLE "Payment" ADD COLUMN "origin" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN "subtotal" TEXT;
ALTER TABLE "Payment" ADD COLUMN "tax" TEXT;
