-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Stored Functions
-- Target: MySQL 8.0+
-- =====================================================================

USE smart_lost_found_db;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Function 1: CountUserItems
-- Returns the total number of reports submitted by a specific user.
-- Returns 0 if user has no reports or if user_id is invalid.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS CountUserItems$$
CREATE FUNCTION CountUserItems(p_user_id INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE total_items INT DEFAULT 0;
    
    IF p_user_id IS NULL OR p_user_id <= 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO total_items
    FROM Items
    WHERE user_id = p_user_id;

    RETURN IFNULL(total_items, 0);
END$$

-- ---------------------------------------------------------------------
-- Function 2: CountOpenItems
-- Returns the total number of currently active OPEN reports across campus.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS CountOpenItems$$
CREATE FUNCTION CountOpenItems()
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE open_count INT DEFAULT 0;

    SELECT COUNT(*) INTO open_count
    FROM Items
    WHERE status = 'OPEN';

    RETURN IFNULL(open_count, 0);
END$$

-- ---------------------------------------------------------------------
-- Function 3: GetCategoryItemCount
-- Returns the total number of reports recorded under a given category.
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS GetCategoryItemCount$$
CREATE FUNCTION GetCategoryItemCount(p_category_id INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE cat_count INT DEFAULT 0;

    IF p_category_id IS NULL OR p_category_id <= 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO cat_count
    FROM Items
    WHERE category_id = p_category_id;

    RETURN IFNULL(cat_count, 0);
END$$

-- ---------------------------------------------------------------------
-- Function 4: GetUserRecoveryCount
-- Returns total items successfully recovered by a specific student
-- (either lost items that were claimed & handed over, or found items claimed by this user).
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS GetUserRecoveryCount$$
CREATE FUNCTION GetUserRecoveryCount(p_user_id INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE recovery_count INT DEFAULT 0;

    IF p_user_id IS NULL OR p_user_id <= 0 THEN
        RETURN 0;
    END IF;

    -- Count handovers where the claimant was this user OR where the user reported a lost item that got recovered
    SELECT COUNT(DISTINCT hr.handover_id) INTO recovery_count
    FROM HandoverRecords hr
    INNER JOIN Claims c ON hr.claim_id = c.claim_id
    INNER JOIN Items i ON hr.item_id = i.item_id
    WHERE c.claimant_id = p_user_id OR (i.user_id = p_user_id AND i.item_type = 'LOST');

    RETURN IFNULL(recovery_count, 0);
END$$

DELIMITER ;
