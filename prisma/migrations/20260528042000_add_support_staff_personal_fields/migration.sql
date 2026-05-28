-- Add personal fields to support_staff so support staff can be created without passwords or dashboard login
ALTER TABLE "support_staff"
  ADD COLUMN "first_name" TEXT,
  ADD COLUMN "last_name" TEXT,
  ADD COLUMN "nic_number" TEXT,
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "address" TEXT,
  ADD COLUMN "phone" TEXT;
