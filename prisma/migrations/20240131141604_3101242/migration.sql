-- DropIndex
DROP INDEX "Contacts_email_key";

-- AlterTable
ALTER TABLE "Companies" ALTER COLUMN "hs_object_id" DROP NOT NULL;
