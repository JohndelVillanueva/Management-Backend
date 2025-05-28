/*
  Warnings:

  - You are about to drop the column `is_verified` on the `verification_tokens` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `users` ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `verification_tokens` DROP COLUMN `is_verified`;
