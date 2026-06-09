/*
  Warnings:

  - You are about to drop the column `stream_id` on the `subjects` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "subjects" DROP CONSTRAINT "subjects_stream_id_fkey";

-- DropIndex
DROP INDEX "subjects_stream_id_idx";

-- AlterTable
ALTER TABLE "subjects" DROP COLUMN "stream_id";

-- CreateTable
CREATE TABLE "_StreamToSubject" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StreamToSubject_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_StreamToSubject_B_index" ON "_StreamToSubject"("B");

-- AddForeignKey
ALTER TABLE "_StreamToSubject" ADD CONSTRAINT "_StreamToSubject_A_fkey" FOREIGN KEY ("A") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StreamToSubject" ADD CONSTRAINT "_StreamToSubject_B_fkey" FOREIGN KEY ("B") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
