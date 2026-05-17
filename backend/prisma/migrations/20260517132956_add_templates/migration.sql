-- CreateTable
CREATE TABLE "event_templates" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_phases" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,

    CONSTRAINT "template_phases_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "template_phases" ADD CONSTRAINT "template_phases_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "event_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
