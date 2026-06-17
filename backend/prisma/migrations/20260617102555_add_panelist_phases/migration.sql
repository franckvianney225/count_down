-- CreateTable
CREATE TABLE "panelist_phases" (
    "panelistId" INTEGER NOT NULL,
    "phaseId" INTEGER NOT NULL,

    CONSTRAINT "panelist_phases_pkey" PRIMARY KEY ("panelistId","phaseId")
);

-- AddForeignKey
ALTER TABLE "panelist_phases" ADD CONSTRAINT "panelist_phases_panelistId_fkey" FOREIGN KEY ("panelistId") REFERENCES "panelists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panelist_phases" ADD CONSTRAINT "panelist_phases_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
