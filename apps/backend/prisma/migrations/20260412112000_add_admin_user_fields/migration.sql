ALTER TABLE "user"
ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN "banned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "banReason" TEXT,
ADD COLUMN "banExpires" TIMESTAMP(3),
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "session"
ADD COLUMN "impersonatedBy" TEXT;

UPDATE "user"
SET "role" = CASE
  WHEN "systemRole" = 'SUPERADMIN' THEN 'superadmin'
  ELSE 'user'
END;

ALTER TABLE "user"
DROP COLUMN "isActive";
