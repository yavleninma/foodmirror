/*
  Warnings:

  - The `status` column on the `DraftMeal` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `estimateJson` on the `Meal` table. All the data in the column will be lost.
  - You are about to drop the column `itemsJson` on the `Meal` table. All the data in the column will be lost.
  - The `state` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `carbsMax` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carbsMean` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `carbsMin` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatMax` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatMean` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fatMin` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kcalMax` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kcalMean` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kcalMin` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proteinMax` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proteinMean` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `proteinMin` to the `Meal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `uncertaintyBand` to the `Meal` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "UserState" AS ENUM ('IDLE', 'DRAFT_MEAL', 'ESTIMATED', 'CLARIFICATION', 'CONFIRM');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT_MEAL', 'ESTIMATED', 'CLARIFICATION', 'CONFIRM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'PHOTO', 'COMMAND', 'CALLBACK', 'SYSTEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "DraftMeal" DROP COLUMN "status",
ADD COLUMN     "status" "DraftStatus" NOT NULL DEFAULT 'DRAFT_MEAL';

-- AlterTable
ALTER TABLE "Meal" DROP COLUMN "estimateJson",
DROP COLUMN "itemsJson",
ADD COLUMN     "carbsMax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "carbsMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "carbsMin" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "fatMax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "fatMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "fatMin" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "kcalMax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "kcalMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "kcalMin" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proteinMax" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proteinMean" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "proteinMin" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "uncertaintyBand" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'ru',
DROP COLUMN "state",
ADD COLUMN     "state" "UserState" NOT NULL DEFAULT 'IDLE';

-- CreateTable
CREATE TABLE "MealComponent" (
    "id" SERIAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    "foodReferenceId" INTEGER,
    "canonicalName" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "weightMean" DOUBLE PRECISION NOT NULL,
    "weightMin" DOUBLE PRECISION NOT NULL,
    "weightMax" DOUBLE PRECISION NOT NULL,
    "confidence" "ConfidenceLevel" NOT NULL,
    "confidenceReasons" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodReference" (
    "id" SERIAL NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "proteinPer100g" DOUBLE PRECISION NOT NULL,
    "fatPer100g" DOUBLE PRECISION NOT NULL,
    "carbsPer100g" DOUBLE PRECISION NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodSource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "messageType" "MessageType" NOT NULL,
    "telegramMessageId" INTEGER,
    "text" TEXT,
    "photoFileId" TEXT,
    "payloadJson" JSONB,
    "draftMealId" INTEGER,
    "mealId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MealComponent_mealId_idx" ON "MealComponent"("mealId");

-- CreateIndex
CREATE INDEX "MealComponent_foodReferenceId_idx" ON "MealComponent"("foodReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodReference_canonicalName_key" ON "FoodReference"("canonicalName");

-- CreateIndex
CREATE UNIQUE INDEX "FoodSource_name_key" ON "FoodSource"("name");

-- CreateIndex
CREATE INDEX "MessageEvent_userId_idx" ON "MessageEvent"("userId");

-- CreateIndex
CREATE INDEX "MessageEvent_createdAt_idx" ON "MessageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_messageType_idx" ON "MessageEvent"("messageType");

-- AddForeignKey
ALTER TABLE "MealComponent" ADD CONSTRAINT "MealComponent_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealComponent" ADD CONSTRAINT "MealComponent_foodReferenceId_fkey" FOREIGN KEY ("foodReferenceId") REFERENCES "FoodReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReference" ADD CONSTRAINT "FoodReference_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FoodSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_draftMealId_fkey" FOREIGN KEY ("draftMealId") REFERENCES "DraftMeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
