/*
  Warnings:

  - You are about to drop the column `department_id` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_department_id_fkey`;

-- DropIndex
DROP INDEX `users_department_id_fkey` ON `users`;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `department_id`,
    ADD COLUMN `department` VARCHAR(191) NULL;

-- DropTable
DROP TABLE `departments`;
