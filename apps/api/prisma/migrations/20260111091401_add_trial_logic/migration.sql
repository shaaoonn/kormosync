-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "hasClaimedTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialEmployeeEndDate" TIMESTAMP(3);
