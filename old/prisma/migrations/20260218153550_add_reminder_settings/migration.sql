-- CreateEnum
CREATE TYPE "ReminderMode" AS ENUM ('OFF', 'NO_MEALS', 'ALWAYS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderHour" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "reminderMode" "ReminderMode" NOT NULL DEFAULT 'NO_MEALS',
ADD COLUMN     "timezoneOffset" INTEGER NOT NULL DEFAULT 180;
