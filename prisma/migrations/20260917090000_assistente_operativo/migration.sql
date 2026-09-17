CREATE TABLE "AiConversation" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "context" JSONB, "busyUntil" DATETIME, "lockToken" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AiMessage" (
  "id" TEXT NOT NULL PRIMARY KEY, "conversationId" TEXT NOT NULL, "payload" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AiOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "conversationId" TEXT,
  "requestKey" TEXT NOT NULL, "command" JSONB NOT NULL, "preview" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "result" JSONB, "error" TEXT,
  "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE "AiSchedule" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true, "hour" INTEGER NOT NULL DEFAULT 8,
  "minute" INTEGER NOT NULL DEFAULT 0, "weekdaysOnly" BOOLEAN NOT NULL DEFAULT true,
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Rome', "followupDays" INTEGER NOT NULL DEFAULT 14,
  "horizonDays" INTEGER NOT NULL DEFAULT 7, "recipientIds" JSONB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AiRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "scheduleId" TEXT NOT NULL, "slot" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING', "leaseUntil" DATETIME NOT NULL,
  "summary" TEXT, "findings" JSONB, "usage" JSONB, "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" DATETIME,
  FOREIGN KEY ("scheduleId") REFERENCES "AiSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Notifica" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "runId" TEXT,
  "titolo" TEXT NOT NULL, "testo" TEXT NOT NULL, "href" TEXT NOT NULL,
  "letta" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("runId") REFERENCES "AiRun"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "Attivita" (
  "id" TEXT NOT NULL PRIMARY KEY, "titolo" TEXT NOT NULL, "note" TEXT, "scadenza" DATETIME,
  "stato" TEXT NOT NULL DEFAULT 'DA_FARE', "userId" TEXT NOT NULL, "commessaId" TEXT, "clienteId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY ("commessaId") REFERENCES "Commessa"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY ("clienteId") REFERENCES "Anagrafica"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "AiConversation_userId_updatedAt_idx" ON "AiConversation"("userId", "updatedAt");
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");
CREATE UNIQUE INDEX "AiOperation_requestKey_key" ON "AiOperation"("requestKey");
CREATE INDEX "AiOperation_userId_createdAt_idx" ON "AiOperation"("userId", "createdAt");
CREATE UNIQUE INDEX "AiRun_scheduleId_slot_key" ON "AiRun"("scheduleId", "slot");
CREATE INDEX "Notifica_userId_letta_createdAt_idx" ON "Notifica"("userId", "letta", "createdAt");
CREATE UNIQUE INDEX "Notifica_userId_runId_key" ON "Notifica"("userId", "runId");
CREATE INDEX "Attivita_userId_stato_scadenza_idx" ON "Attivita"("userId", "stato", "scadenza");
