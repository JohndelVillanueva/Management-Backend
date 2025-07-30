/*
  Warnings:

  - You are about to drop the column `type` on the `cards` table. All the data in the column will be lost.
  - Added the required column `departmentId` to the `cards` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `cards` DROP COLUMN `type`,
    ADD COLUMN `departmentId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `cards` ADD CONSTRAINT `cards_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
