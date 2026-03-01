-- AlterTable
ALTER TABLE "FoodReference" ADD COLUMN     "fdcId" INTEGER;

-- CreateIndex
CREATE INDEX "FoodReference_fdcId_idx" ON "FoodReference"("fdcId");
