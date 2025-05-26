/*
  Warnings:

  - You are about to drop the column `userId` on the `verification_tokens` table. All the data in the column will be lost.
  - Added the required column `user_id` to the `verification_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `verification_tokens` DROP FOREIGN KEY `verification_tokens_userId_fkey`;

-- DropIndex
DROP INDEX `verification_tokens_userId_fkey` ON `verification_tokens`;

-- AlterTable
ALTER TABLE `verification_tokens` DROP COLUMN `userId`,
    ADD COLUMN `user_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `verification_tokens` ADD CONSTRAINT `verification_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
