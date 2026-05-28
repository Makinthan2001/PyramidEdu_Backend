/*
  Warnings:

  - A unique constraint covering the columns `[nic_number]` on the table `managers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `address` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `first_name` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `last_name` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nic_number` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `managers` table without a default value. This is not possible if the table is not empty.
  - Made the column `nic_number` on table `teachers` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "managers" ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "first_name" TEXT NOT NULL,
ADD COLUMN     "gender" "Gender" NOT NULL,
ADD COLUMN     "last_name" TEXT NOT NULL,
ADD COLUMN     "nic_number" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "salary" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "teachers" ALTER COLUMN "address" DROP DEFAULT,
ALTER COLUMN "gender" DROP DEFAULT,
ALTER COLUMN "nic_number" SET NOT NULL,
ALTER COLUMN "phone" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "managers_nic_number_key" ON "managers"("nic_number");
