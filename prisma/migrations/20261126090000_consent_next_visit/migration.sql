-- Iteration 18: a new form version is signed at the next new treatment or session (design D1, D3)
-- Versions published so far required everyone to sign again, so existing rows get true. ConsentTextVersion is
-- append-only (trigger "ConsentTextVersion_immutable"), so the value comes from the column default, not an UPDATE.
ALTER TABLE "ConsentTextVersion" ADD COLUMN "resignRequired" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ConsentTextVersion" ALTER COLUMN "resignRequired" SET DEFAULT false;
ALTER TABLE "Patient" ADD COLUMN "signatureRequiredVersion" INTEGER;
