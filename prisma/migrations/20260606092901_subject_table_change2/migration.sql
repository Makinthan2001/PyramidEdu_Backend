/*
  Warnings:

  - You are about to drop the `_StreamToSubject` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `stream_id` to the `subjects` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_StreamToSubject" DROP CONSTRAINT "_StreamToSubject_A_fkey";

-- DropForeignKey
ALTER TABLE "_StreamToSubject" DROP CONSTRAINT "_StreamToSubject_B_fkey";

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "stream_id" TEXT NOT NULL;

-- DropTable
DROP TABLE "_StreamToSubject";

-- CreateIndex
CREATE INDEX "subjects_stream_id_idx" ON "subjects"("stream_id");

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
