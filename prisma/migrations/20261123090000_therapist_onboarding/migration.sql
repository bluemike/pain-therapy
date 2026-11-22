-- Iteration 16 (design D1 to D7): invitation by SMS, mailboxes at pain-therapy.online and their handover.
-- Users, invitations, codes, SMS and mailboxes have no practice rows (like iteration 12): no row-level security; the
-- app filters by practice itself.

ALTER TYPE "LoginCodePurpose" ADD VALUE 'INVITATION_SMS';
ALTER TYPE "LoginCodePurpose" ADD VALUE 'MOBILE_CHANGE';

CREATE TYPE "InvitationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "SmsPurpose" AS ENUM ('INVITATION', 'CODE', 'MAILBOX_READY');
CREATE TYPE "SmsStatus" AS ENUM ('SENT', 'FAILED');
CREATE TYPE "MailboxMode" AS ENUM ('NEW', 'EXISTING');
CREATE TYPE "MailboxStatus" AS ENUM ('CREATED', 'FAILED', 'DELETED');
CREATE TYPE "MailboxAccess" AS ENUM ('OPEN', 'READY', 'DELIVERED', 'EXPIRED');

ALTER TABLE "User" ADD COLUMN "mobile" TEXT;
ALTER TABLE "LoginCode" ADD COLUMN "target" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "channel" "InvitationChannel" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "mobile" TEXT;
ALTER TABLE "Practice" ADD COLUMN "mailboxQuota" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE "SmsMessage" (
  "id"           TEXT NOT NULL,
  "toMasked"     TEXT NOT NULL,
  "purpose"      "SmsPurpose" NOT NULL,
  "status"       "SmsStatus" NOT NULL,
  "error"        TEXT,
  "invitationId" TEXT,
  "userId"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SmsMessage_createdAt_idx" ON "SmsMessage"("createdAt");
CREATE INDEX "SmsMessage_invitationId_createdAt_idx" ON "SmsMessage"("invitationId", "createdAt");
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MailboxProvisioning" (
  "id"                TEXT NOT NULL,
  "address"           TEXT NOT NULL,
  "mode"              "MailboxMode" NOT NULL,
  "status"            "MailboxStatus" NOT NULL,
  "lastError"         TEXT,
  "practiceId"        TEXT,
  "invitationId"      TEXT,
  "userId"            TEXT,
  "access"            "MailboxAccess" NOT NULL DEFAULT 'OPEN',
  "handoverEnc"       TEXT,
  "handoverExpiresAt" TIMESTAMP(3),
  "handedOverAt"      TIMESTAMP(3),
  "deliveredAt"       TIMESTAMP(3),
  "requestedAt"       TIMESTAMP(3),
  "profileTokenHash"  TEXT,
  "profileEnc"        TEXT,
  "profileExpiresAt"  TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailboxProvisioning_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MailboxProvisioning_address_key" ON "MailboxProvisioning"("address");
CREATE UNIQUE INDEX "MailboxProvisioning_invitationId_key" ON "MailboxProvisioning"("invitationId");
CREATE UNIQUE INDEX "MailboxProvisioning_profileTokenHash_key" ON "MailboxProvisioning"("profileTokenHash");
CREATE INDEX "MailboxProvisioning_practiceId_idx" ON "MailboxProvisioning"("practiceId");
CREATE INDEX "MailboxProvisioning_access_idx" ON "MailboxProvisioning"("access");
ALTER TABLE "MailboxProvisioning" ADD CONSTRAINT "MailboxProvisioning_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailboxProvisioning" ADD CONSTRAINT "MailboxProvisioning_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MailboxProvisioning" ADD CONSTRAINT "MailboxProvisioning_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
