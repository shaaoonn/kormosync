/*
  Warnings:

  - You are about to drop the column `customFields` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the column `requiredApps` on the `Task` table. All the data in the column will be lost.
  - The `priority` column on the `Task` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `title` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Task" DROP COLUMN "customFields",
DROP COLUMN "requiredApps",
ADD COLUMN     "audioUrl" TEXT,
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "description" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL,
ALTER COLUMN "title" SET NOT NULL,
ALTER COLUMN "descriptionRaw" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS',
DROP COLUMN "priority",
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_isPublic_idx" ON "User"("isPublic");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
