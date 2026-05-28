-- Remove department from managers now that manager creation no longer uses it
ALTER TABLE "managers" DROP COLUMN "department";
