-- AlterTable
ALTER TABLE "User" ADD COLUMN     "trialEndReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "trialReminderSent1At" TIMESTAMP(3),
ADD COLUMN     "trialReminderSent3At" TIMESTAMP(3),
ADD COLUMN     "trialReminderSent7At" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SubscriptionAdminLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "previousEnd" TIMESTAMP(3),
    "newEnd" TIMESTAMP(3),
    "adminChatId" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionAdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionAdminLog_userId_idx" ON "SubscriptionAdminLog"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionAdminLog_createdAt_idx" ON "SubscriptionAdminLog"("createdAt");
