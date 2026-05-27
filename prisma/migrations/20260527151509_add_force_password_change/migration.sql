-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPPORT_STAFF';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "force_password_change" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" INTEGER,
    "resource_type" TEXT NOT NULL,
    "resource_id" INTEGER NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_resource" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "idx_audit_timestamp" ON "audit_logs"("created_at");
