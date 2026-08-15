-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_License" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "activationKey" TEXT,
    "product" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_hwid',
    "licenseType" TEXT NOT NULL DEFAULT 'lifetime',
    "userName" TEXT,
    "customerId" TEXT,
    "paymentId" TEXT,
    "hwid" TEXT,
    "activatedAt" DATETIME,
    "expiresAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "License_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "License_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_License" ("activatedAt", "createdAt", "customerId", "expiresAt", "hwid", "id", "key", "notes", "paymentId", "product", "status", "updatedAt") SELECT "activatedAt", "createdAt", "customerId", "expiresAt", "hwid", "id", "key", "notes", "paymentId", "product", "status", "updatedAt" FROM "License";
DROP TABLE "License";
ALTER TABLE "new_License" RENAME TO "License";
CREATE UNIQUE INDEX "License_key_key" ON "License"("key");
CREATE UNIQUE INDEX "License_activationKey_key" ON "License"("activationKey");
CREATE INDEX "License_product_idx" ON "License"("product");
CREATE INDEX "License_status_idx" ON "License"("status");
CREATE INDEX "License_customerId_idx" ON "License"("customerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
