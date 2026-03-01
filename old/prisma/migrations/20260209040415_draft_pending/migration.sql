-- AlterTable
ALTER TABLE "DraftMeal" ADD COLUMN     "draftConversation" JSONB,
ADD COLUMN     "llmPending" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "llmPendingStartedAt" TIMESTAMP(3);
