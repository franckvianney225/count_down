-- CreateTable
CREATE TABLE "timer_settings" (
    "id" SERIAL NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 1800,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "remainingSeconds" INTEGER NOT NULL DEFAULT 1800,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timer_settings_pkey" PRIMARY KEY ("id")
);
