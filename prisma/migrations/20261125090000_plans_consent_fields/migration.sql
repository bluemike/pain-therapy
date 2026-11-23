-- Iteration 17: plans with a patient limit (design D7), fields in the consent form (design D1, D3, D4)
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "patientLimit" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");
INSERT INTO "Plan" ("id", "name", "patientLimit", "sortOrder") VALUES
    ('freemium', 'Freemium', 20, 10),
    ('unlimited', 'Unlimited', NULL, 20);

ALTER TABLE "Practice"
    ADD COLUMN "privacyOfficer" TEXT,
    ADD COLUMN "templateSeen" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "planId" TEXT NOT NULL DEFAULT 'freemium',
    ADD COLUMN "planChangedAt" TIMESTAMP(3),
    ADD COLUMN "planChangedBy" TEXT,
    ADD COLUMN "limitNotifiedAt" TIMESTAMP(3);
ALTER TABLE "Practice" ADD CONSTRAINT "Practice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Mike's own practice keeps working without a limit (design D7)
UPDATE "Practice" SET "planId" = 'unlimited' WHERE "id" = 'prc_falera';

-- Responsible person: the first active practice admin (design D4)
UPDATE "Practice" p SET "privacyOfficer" = (
    SELECT u."name" FROM "PracticeMembership" m
    JOIN "User" u ON u."id" = m."userId"
    WHERE m."practiceId" = p."id" AND m."active" AND 'PRACTICE_ADMIN' = ANY (m."roles")
    ORDER BY m."createdAt" LIMIT 1
);

ALTER TABLE "SignatureSession" ADD COLUMN "fieldValues" JSONB;
