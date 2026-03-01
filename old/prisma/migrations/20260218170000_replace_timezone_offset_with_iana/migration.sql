ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Moscow';
ALTER TABLE "User" DROP COLUMN "timezoneOffset";
