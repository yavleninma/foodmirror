-- AlterTable
ALTER TABLE "FoodReference" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "dataCompleteness" DOUBLE PRECISION,
ADD COLUMN     "locale" TEXT,
ADD COLUMN     "offProductId" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "FoodAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "foodReferenceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodAlias_alias_idx" ON "FoodAlias"("alias");

-- CreateIndex
CREATE INDEX "FoodAlias_foodReferenceId_idx" ON "FoodAlias"("foodReferenceId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodAlias_alias_locale_key" ON "FoodAlias"("alias", "locale");

-- CreateIndex
CREATE INDEX "FoodReference_barcode_idx" ON "FoodReference"("barcode");

-- AddForeignKey
ALTER TABLE "FoodAlias" ADD CONSTRAINT "FoodAlias_foodReferenceId_fkey" FOREIGN KEY ("foodReferenceId") REFERENCES "FoodReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
