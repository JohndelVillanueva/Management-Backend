/*
  Warnings:

  - Added the required column `is_verified` to the `verification_tokens` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `verification_tokens` ADD COLUMN `is_verified` INTEGER NOT NULL;
