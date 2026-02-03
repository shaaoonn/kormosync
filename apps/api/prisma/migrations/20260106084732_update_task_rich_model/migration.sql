-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "manualAllowedApps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "resourceLinks" TEXT[] DEFAULT ARRAY[]::TEXT[];
