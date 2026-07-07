-- Project-setup details captured at the from-proposal gate (the Baraza council's
-- most frequent HIGH-severity gaps: maintenance/recurrent cost, site, land tenure,
-- beneficiaries). Idempotent so it is safe on databases that already have these
-- columns from an earlier `db push` (dev + test).

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "maintenancePlan" TEXT,
  ADD COLUMN IF NOT EXISTS "recurrentCostKes" DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS "recurrentCostPeriod" TEXT,
  ADD COLUMN IF NOT EXISTS "siteLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "landTenure" TEXT,
  ADD COLUMN IF NOT EXISTS "beneficiaries" TEXT;
