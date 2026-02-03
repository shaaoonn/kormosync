-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "billingType" "BillingType" NOT NULL DEFAULT 'HOURLY',
ADD COLUMN     "endTime" TEXT,
ADD COLUMN     "estimatedHours" DOUBLE PRECISION,
ADD COLUMN     "fixedPrice" DOUBLE PRECISION,
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "scheduleDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "scheduleType" "ScheduleType",
ADD COLUMN     "startTime" TEXT;
