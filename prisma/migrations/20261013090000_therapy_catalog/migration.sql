-- Iteration 2, therapy-catalog (design D1, D2). Additive only.

-- CreateEnum
CREATE TYPE "PointEmphasis" AS ENUM ('main', 'relevant', 'standard');

-- CreateTable
CREATE TABLE "Region" (
    "id" INTEGER NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sheetTitle" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OsteopressurePoint" (
    "id" TEXT NOT NULL,
    "group" INTEGER NOT NULL,
    "muscleAttachmentLatin" TEXT NOT NULL,
    "attachmentDe" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "OsteopressurePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegionPoint" (
    "regionId" INTEGER NOT NULL,
    "pointId" TEXT NOT NULL,
    "emphasis" "PointEmphasis" NOT NULL,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "RegionPoint_pkey" PRIMARY KEY ("regionId","pointId")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "code" TEXT NOT NULL,
    "group" INTEGER NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "stretchSteps" INTEGER,
    "rolling" JSONB,
    "variants" JSONB,
    "source" TEXT,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "RegionExercise" (
    "regionId" INTEGER NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "RegionExercise_pkey" PRIMARY KEY ("regionId","exerciseCode")
);

-- CreateTable
CREATE TABLE "RollingTool" (
    "code" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "RollingTool_pkey" PRIMARY KEY ("code")
);

-- AddForeignKey
ALTER TABLE "RegionPoint" ADD CONSTRAINT "RegionPoint_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionPoint" ADD CONSTRAINT "RegionPoint_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "OsteopressurePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionExercise" ADD CONSTRAINT "RegionExercise_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegionExercise" ADD CONSTRAINT "RegionExercise_exerciseCode_fkey" FOREIGN KEY ("exerciseCode") REFERENCES "Exercise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Catalog entries are retired (retiredAt), never deleted, so recorded consultations stay valid
CREATE TRIGGER "Region_no_delete" BEFORE DELETE ON "Region" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "OsteopressurePoint_no_delete" BEFORE DELETE ON "OsteopressurePoint" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "RegionPoint_no_delete" BEFORE DELETE ON "RegionPoint" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "Exercise_no_delete" BEFORE DELETE ON "Exercise" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "RegionExercise_no_delete" BEFORE DELETE ON "RegionExercise" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "RollingTool_no_delete" BEFORE DELETE ON "RollingTool" FOR EACH ROW EXECUTE FUNCTION reject_delete();
