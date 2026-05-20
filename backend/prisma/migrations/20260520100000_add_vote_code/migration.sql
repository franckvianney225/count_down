-- Add unique code to vote_questions
ALTER TABLE "vote_questions" ADD COLUMN "code" TEXT;

-- Populate existing rows with a unique code
UPDATE "vote_questions" SET "code" = substr(md5(random()::text || id::text), 1, 8) WHERE "code" IS NULL;

-- Make it NOT NULL and UNIQUE
ALTER TABLE "vote_questions" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX "vote_questions_code_key" ON "vote_questions"("code");
