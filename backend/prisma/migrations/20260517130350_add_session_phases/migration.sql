-- CreateTable
CREATE TABLE "event_sessions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Session',
    "currentPhaseIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "pausedRemaining" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phases" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,

    CONSTRAINT "phases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "phases" ADD CONSTRAINT "phases_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "event_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
