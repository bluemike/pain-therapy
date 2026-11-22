-- Iteration 16: Reply-To of patient mails is the address of the therapist who sent them
ALTER TABLE "EmailDelivery" ADD COLUMN "replyTo" TEXT;
ALTER TABLE "HandoutDelivery" ADD COLUMN "replyTo" TEXT;
ALTER TABLE "AccessLinkDelivery" ADD COLUMN "replyTo" TEXT;
