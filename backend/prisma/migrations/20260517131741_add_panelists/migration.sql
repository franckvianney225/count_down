-- CreateTable
CREATE TABLE "panelists" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "totalSeconds" INTEGER NOT NULL,
    "usedSeconds" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "panelists_pkey" PRIMARY KEY ("id")
);
