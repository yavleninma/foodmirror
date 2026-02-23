-- Remove CLARIFICATION from UserState and DraftStatus (restore feature removed)

-- Update any rows using CLARIFICATION before altering enums
UPDATE "User" SET state = 'IDLE' WHERE state = 'CLARIFICATION';
UPDATE "DraftMeal" SET status = 'DRAFT_MEAL' WHERE status = 'CLARIFICATION';

-- Recreate UserState enum without CLARIFICATION
ALTER TYPE "UserState" RENAME TO "UserState_old";
CREATE TYPE "UserState" AS ENUM ('IDLE', 'DRAFT_MEAL', 'ESTIMATED', 'CONFIRM');
ALTER TABLE "User" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "state" TYPE "UserState" USING ("state"::text::"UserState");
ALTER TABLE "User" ALTER COLUMN "state" SET DEFAULT 'IDLE';
DROP TYPE "UserState_old";

-- Recreate DraftStatus enum without CLARIFICATION
ALTER TYPE "DraftStatus" RENAME TO "DraftStatus_old";
CREATE TYPE "DraftStatus" AS ENUM ('DRAFT_MEAL', 'ESTIMATED', 'CONFIRM');
ALTER TABLE "DraftMeal" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "DraftMeal" ALTER COLUMN "status" TYPE "DraftStatus" USING ("status"::text::"DraftStatus");
ALTER TABLE "DraftMeal" ALTER COLUMN "status" SET DEFAULT 'DRAFT_MEAL';
DROP TYPE "DraftStatus_old";
