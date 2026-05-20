-- Add multiChoice column
ALTER TABLE "vote_questions" ADD COLUMN "multiChoice" BOOLEAN NOT NULL DEFAULT false;

-- Drop old unique index (token + questionId)
DROP INDEX IF EXISTS "vote_responses_token_questionId_key";

-- New unique constraint (token + questionId + optionId) for multi-choice support
ALTER TABLE "vote_responses" ADD CONSTRAINT "vote_responses_token_questionId_optionId_key" UNIQUE ("token", "questionId", "optionId");
