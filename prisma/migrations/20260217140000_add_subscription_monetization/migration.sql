-- Add subscription fields to User
ALTER TABLE "User" ADD COLUMN "trialStartedAt" TIMESTAMP(3),
ADD COLUMN "subscribedUntil" TIMESTAMP(3),
ADD COLUMN "lastPaymentChargeId" TEXT;

-- CreateTable FreeUsage (free tier limits per day)
CREATE TABLE "FreeUsage" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dayKey" TEXT NOT NULL,
    "estimatesUsed" INTEGER NOT NULL DEFAULT 0,
    "confirmsUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FreeUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FreeUsage_userId_dayKey_key" ON "FreeUsage"("userId", "dayKey");
CREATE INDEX "FreeUsage_userId_idx" ON "FreeUsage"("userId");

ALTER TABLE "FreeUsage" ADD CONSTRAINT "FreeUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable SubscriptionGrant (manual admin grants)
CREATE TABLE "SubscriptionGrant" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "grantedUntil" TIMESTAMP(3) NOT NULL,
    "grantedBy" TEXT,
    "reason" TEXT,

    CONSTRAINT "SubscriptionGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionGrant_userId_idx" ON "SubscriptionGrant"("userId");

ALTER TABLE "SubscriptionGrant" ADD CONSTRAINT "SubscriptionGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
