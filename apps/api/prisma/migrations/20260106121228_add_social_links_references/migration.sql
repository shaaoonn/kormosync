-- AlterTable
ALTER TABLE "User" ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "github" TEXT,
ADD COLUMN     "references" JSONB,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "youtube" TEXT;
