-- AlterTable
ALTER TABLE "FoodReference" ADD COLUMN "kcalPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill: kcal = 4*protein + 9*fat + 4*carbs per 100g
UPDATE "FoodReference"
SET "kcalPer100g" = "proteinPer100g" * 4 + "fatPer100g" * 9 + "carbsPer100g" * 4;
