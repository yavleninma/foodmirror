-- AlterTable
ALTER TABLE "FoodReference" ADD COLUMN     "fiberPer100g" DOUBLE PRECISION,
ADD COLUMN     "foodCategory" TEXT,
ADD COLUMN     "nutrientRanges" JSONB,
ADD COLUMN     "portionsJson" JSONB;
