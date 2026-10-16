-- Iteration 6 (signing-zone-only, design D2): the patient mode on the iPad is gone. Sessions started there and never
-- finished can no longer be completed, so they are aborted. Signed iPad sessions and their PDFs stay unchanged; the
-- enum value IPAD stays for them.
UPDATE "SignatureSession"
SET "status" = 'ABORTED', "abortedAt" = COALESCE("abortedAt", CURRENT_TIMESTAMP)
WHERE "channel" = 'IPAD' AND "status" = 'OPEN';
