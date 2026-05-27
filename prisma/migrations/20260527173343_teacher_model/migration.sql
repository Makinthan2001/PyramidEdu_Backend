/*
  Warnings:

  - A unique constraint covering the columns `[nic_number]` on the table `teachers` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "teachers" ADD COLUMN     "address" TEXT NOT NULL DEFAULT 'Not provided',
ADD COLUMN     "gender" "Gender" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "nic_number" TEXT,
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT 'Not provided';

-- CreateIndex
CREATE UNIQUE INDEX "teachers_nic_number_key" ON "teachers"("nic_number");
