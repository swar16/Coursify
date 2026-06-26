-- DropForeignKey
ALTER TABLE "Discussion" DROP CONSTRAINT "Discussion_parentId_fkey";

-- AddForeignKey
ALTER TABLE "Discussion" ADD CONSTRAINT "Discussion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Discussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
