-- Fix for duplicate column error
-- Only add columns that don't exist yet

-- Add rule_type if missing
SET @exist := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'library_policy_rules' 
    AND COLUMN_NAME = 'rule_type'
    AND TABLE_SCHEMA = DATABASE()
);
SET @sqlstmt := IF(@exist = 0, 
    'ALTER TABLE library_policy_rules ADD COLUMN rule_type ENUM("standard", "exception", "override") DEFAULT "standard" AFTER priority', 
    'SELECT "rule_type column already exists" as message'
);
PREPARE stmt FROM @sqlstmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add condition_logic if missing
SET @exist2 := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'library_policy_rules' 
    AND COLUMN_NAME = 'condition_logic'
    AND TABLE_SCHEMA = DATABASE()
);
SET @sqlstmt2 := IF(@exist2 = 0, 
    'ALTER TABLE library_policy_rules ADD COLUMN condition_logic VARCHAR(10) DEFAULT "AND" AFTER rule_type', 
    'SELECT "condition_logic column already exists" as message'
);
PREPARE stmt2 FROM @sqlstmt2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- Verify columns
DESCRIBE library_policy_rules;
