-- CreateTable
CREATE TABLE "CheckoutIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "txnId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "CheckoutIntent_status_idx" ON "CheckoutIntent"("status");

-- CreateIndex
CREATE INDEX "CheckoutIntent_createdAt_idx" ON "CheckoutIntent"("createdAt");
