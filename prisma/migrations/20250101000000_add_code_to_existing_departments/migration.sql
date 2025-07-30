-- Add code column to departments table
ALTER TABLE `departments` ADD COLUMN `code` VARCHAR(191) NULL;

-- Update existing departments with default codes based on their names
UPDATE `departments` SET `code` = UPPER(SUBSTRING(`name`, 1, 3)) WHERE `code` IS NULL;

-- Make code column NOT NULL and add unique constraint
ALTER TABLE `departments` MODIFY COLUMN `code` VARCHAR(191) NOT NULL;
ALTER TABLE `departments` ADD UNIQUE INDEX `departments_code_key`(`code`); 