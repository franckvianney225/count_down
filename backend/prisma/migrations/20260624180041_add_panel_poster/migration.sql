-- AlterTable
ALTER TABLE "timer_settings" ADD COLUMN     "panelPosterUrl" TEXT,
ADD COLUMN     "panelPosterVisible" BOOLEAN NOT NULL DEFAULT false;
