-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "fullName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "weeklyIncome" DOUBLE PRECISION NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'Bike',
    "planTier" TEXT NOT NULL DEFAULT 'Standard',
    "phoneMasked" TEXT,
    "phoneHash" TEXT,
    "phoneEncrypted" TEXT,
    "upiHash" TEXT,
    "upiEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "premiumAmount" DOUBLE PRECISION NOT NULL,
    "activeStatus" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvent" (
    "id" SERIAL NOT NULL,
    "policyId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "zone" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "payoutAmount" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "frs1" DOUBLE PRECISION,
    "frs2" DOUBLE PRECISION,
    "frs3" DOUBLE PRECISION,
    "frsLocation" DOUBLE PRECISION,
    "frsDevice" DOUBLE PRECISION,
    "frsBehavior" DOUBLE PRECISION,
    "frsNetwork" DOUBLE PRECISION,
    "frsEvent" DOUBLE PRECISION,
    "explanation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "transactionId" TEXT,
    "tokenId" INTEGER,
    "dataHash" TEXT,
    "rainMmAtTrigger" DOUBLE PRECISION,
    "aqiAtTrigger" DOUBLE PRECISION,
    "driverLat" DOUBLE PRECISION,
    "driverLon" DOUBLE PRECISION,
    "deviceHash" TEXT,
    "ipAddressHash" TEXT,
    "upiHash" TEXT,
    "clusterFlagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClaimEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "claimEventId" INTEGER,
    "tokenId" INTEGER,
    "txType" TEXT NOT NULL DEFAULT 'payout',
    "event" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phoneHash_key" ON "Driver"("phoneHash");

-- CreateIndex
CREATE INDEX "Policy_driverId_activeStatus_endDate_idx" ON "Policy"("driverId", "activeStatus", "endDate");

-- CreateIndex
CREATE INDEX "ClaimEvent_driverId_timestamp_idx" ON "ClaimEvent"("driverId", "timestamp");

-- CreateIndex
CREATE INDEX "ClaimEvent_zone_timestamp_idx" ON "ClaimEvent"("zone", "timestamp");

-- CreateIndex
CREATE INDEX "ClaimEvent_status_timestamp_idx" ON "ClaimEvent"("status", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_claimEventId_key" ON "WalletTransaction"("claimEventId");

-- CreateIndex
CREATE INDEX "WalletTransaction_driverId_timestamp_idx" ON "WalletTransaction"("driverId", "timestamp");

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvent" ADD CONSTRAINT "ClaimEvent_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_claimEventId_fkey" FOREIGN KEY ("claimEventId") REFERENCES "ClaimEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
