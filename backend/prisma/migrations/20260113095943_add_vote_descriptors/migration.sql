-- AlterTable
ALTER TABLE "public"."ClimbGradeVote" ADD COLUMN     "descriptors" TEXT[] DEFAULT ARRAY[]::TEXT[];
