-- CreateTable
CREATE TABLE "secret_santa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "secret_santa_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_santa_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "secret_santa_participant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretSantaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientId" TEXT,
    CONSTRAINT "secret_santa_participant_secretSantaId_fkey" FOREIGN KEY ("secretSantaId") REFERENCES "secret_santa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_santa_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_santa_participant_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "secret_santa_exclusion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "secretSantaId" TEXT NOT NULL,
    "giverId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    CONSTRAINT "secret_santa_exclusion_secretSantaId_fkey" FOREIGN KEY ("secretSantaId") REFERENCES "secret_santa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_santa_exclusion_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "secret_santa_exclusion_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_id_key" ON "secret_santa"("id");

-- CreateIndex
CREATE INDEX "secret_santa_groupId_idx" ON "secret_santa"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_participant_id_key" ON "secret_santa_participant"("id");

-- CreateIndex
CREATE INDEX "secret_santa_participant_userId_idx" ON "secret_santa_participant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_participant_secretSantaId_userId_key" ON "secret_santa_participant"("secretSantaId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_participant_secretSantaId_recipientId_key" ON "secret_santa_participant"("secretSantaId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_exclusion_id_key" ON "secret_santa_exclusion"("id");

-- CreateIndex
CREATE UNIQUE INDEX "secret_santa_exclusion_secretSantaId_giverId_receiverId_key" ON "secret_santa_exclusion"("secretSantaId", "giverId", "receiverId");
