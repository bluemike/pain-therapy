-- Iteration 3, exercise-library (design D1 to D3). Additive only.

-- CreateTable
CREATE TABLE "ExerciseSheet" (
    "exerciseCode" TEXT NOT NULL,
    "sheetPage" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "mainImage" TEXT NOT NULL,
    "sheetImage" TEXT NOT NULL,
    "stepLabels" JSONB NOT NULL,
    "stretchSecondsPerSide" INTEGER,
    "sides" INTEGER NOT NULL,
    "rollingSeconds" INTEGER,
    "timingSource" TEXT,
    "timingTodo" JSONB,
    "content" JSONB,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseSheet_pkey" PRIMARY KEY ("exerciseCode")
);

-- AddForeignKey
ALTER TABLE "ExerciseSheet" ADD CONSTRAINT "ExerciseSheet_exerciseCode_fkey" FOREIGN KEY ("exerciseCode") REFERENCES "Exercise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Like the other catalog tables: retired (retiredAt), never deleted
CREATE TRIGGER "ExerciseSheet_no_delete" BEFORE DELETE ON "ExerciseSheet" FOR EACH ROW EXECUTE FUNCTION reject_delete();
