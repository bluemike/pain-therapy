ALTER TYPE "InvitationChannel" ADD VALUE 'BOTH';
ALTER TABLE "Invitation" ADD COLUMN "notifyEmail" TEXT;
