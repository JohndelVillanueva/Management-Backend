/*
  Warnings:

  - You are about to alter the column `user_type` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `users` MODIFY `user_type` ENUM('ADMIN', 'HEAD', 'STAFF') NOT NULL DEFAULT 'STAFF';
