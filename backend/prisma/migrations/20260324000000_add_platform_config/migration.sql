-- CreateTable: platform_config
-- Key/value store for platform operational settings (costs, dues tiers, etc.)

CREATE TABLE "platform_config" (
    "key"         VARCHAR(100) NOT NULL,
    "value"       VARCHAR(500) NOT NULL,
    "label"       VARCHAR(200) NOT NULL,
    "category"    VARCHAR(50)  NOT NULL,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" UUID,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
