-- CreateTable
CREATE TABLE "MlModel" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "file_path" TEXT NOT NULL,
    "metrics" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MlModel_version_key" ON "MlModel"("version");

-- CreateIndex
CREATE INDEX "MlModel_is_active_idx" ON "MlModel"("is_active");
