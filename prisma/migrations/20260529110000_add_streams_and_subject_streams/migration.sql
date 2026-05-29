-- Create streams table
CREATE TABLE "streams" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "streams_pkey" PRIMARY KEY ("id")
);

-- Create subject_streams join table
CREATE TABLE "subject_streams" (
    "subject_id" INTEGER NOT NULL,
    "stream_id" INTEGER NOT NULL,

    CONSTRAINT "subject_streams_pkey" PRIMARY KEY ("subject_id", "stream_id")
);

-- Unique and index constraints
CREATE UNIQUE INDEX "streams_name_key" ON "streams"("name");
CREATE INDEX "idx_subject_stream_stream" ON "subject_streams"("stream_id");

-- Foreign keys
ALTER TABLE "subject_streams"
ADD CONSTRAINT "subject_streams_subject_id_fkey"
FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subject_streams"
ADD CONSTRAINT "subject_streams_stream_id_fkey"
FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
