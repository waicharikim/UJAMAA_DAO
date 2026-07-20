-- AlterEnum: Replace old EmergencyType values with user-facing types
-- PostgreSQL requires new enum values to be in a committed transaction
-- before they can be used, so we recreate the type directly.

-- Step 1: Create new enum type
CREATE TYPE "EmergencyType_new" AS ENUM ('FIRE', 'FLOOD', 'MEDICAL', 'SECURITY', 'ACCIDENT', 'OTHER');

-- Step 2: Migrate any existing rows (old values → sensible defaults)
ALTER TABLE "EmergencyAlert" ALTER COLUMN "emergencyType" TYPE "EmergencyType_new"
  USING (
    CASE "emergencyType"::text
      WHEN 'HEALTH_CRISIS'           THEN 'MEDICAL'
      WHEN 'CONFLICT'                THEN 'SECURITY'
      ELSE 'OTHER'
    END
  )::"EmergencyType_new";

-- Step 3: Drop old type and rename new one
DROP TYPE "EmergencyType";
ALTER TYPE "EmergencyType_new" RENAME TO "EmergencyType";
