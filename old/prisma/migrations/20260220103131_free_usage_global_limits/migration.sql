-- AlterTable
ALTER TABLE "FreeUsage" ADD COLUMN     "estimateRequestsUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "photosUsed" INTEGER NOT NULL DEFAULT 0;
