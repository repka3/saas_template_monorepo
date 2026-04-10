-- CreateEnum
CREATE TYPE "SystemRole" AS ENUM ('USER', 'SUPERADMIN');

-- AlterTable
ALTER TABLE "user"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "systemRole" "SystemRole" NOT NULL DEFAULT 'USER';
