-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('New', 'Contacted', 'Qualified', 'Converted', 'Lost');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('Created', 'Updated', 'StatusChanged');

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phoneNumber" VARCHAR(40),
    "company" VARCHAR(160),
    "serviceInterested" VARCHAR(160),
    "status" "LeadStatus" NOT NULL DEFAULT 'New',
    "followUpDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "fromStatus" "LeadStatus",
    "toStatus" "LeadStatus",
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_userId_idx" ON "Lead"("userId");

-- CreateIndex
CREATE INDEX "Lead_userId_status_idx" ON "Lead"("userId", "status");

-- CreateIndex
CREATE INDEX "Lead_userId_createdAt_idx" ON "Lead"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_userId_followUpDate_idx" ON "Lead"("userId", "followUpDate");

-- CreateIndex
CREATE INDEX "Lead_userId_name_idx" ON "Lead"("userId", "name");

-- CreateIndex
CREATE INDEX "LeadActivity_userId_createdAt_idx" ON "LeadActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
