-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Stored Procedures
-- Target: MySQL 8.0+
-- =====================================================================

USE smart_lost_found_db;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Procedure 1: SubmitItemReport
-- Inserts a validated lost or found report and returns the new item_id
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SubmitItemReport$$
CREATE PROCEDURE SubmitItemReport(
    IN p_user_id INT,
    IN p_category_id INT,
    IN p_location_id INT,
    IN p_item_type VARCHAR(10),
    IN p_title VARCHAR(150),
    IN p_description TEXT,
    IN p_item_date DATE,
    IN p_image_url VARCHAR(255),
    OUT p_item_id INT
)
proc_label: BEGIN
    -- Validate user existence
    IF NOT EXISTS (SELECT 1 FROM Users WHERE user_id = p_user_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid user ID.';
    END IF;

    -- Validate category
    IF NOT EXISTS (SELECT 1 FROM Categories WHERE category_id = p_category_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid category ID.';
    END IF;

    -- Validate location
    IF NOT EXISTS (SELECT 1 FROM Locations WHERE location_id = p_location_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid location ID.';
    END IF;

    -- Validate item type
    IF p_item_type NOT IN ('LOST', 'FOUND') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item type must be LOST or FOUND.';
    END IF;

    -- Validate title
    IF p_title IS NULL OR TRIM(p_title) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item title cannot be empty.';
    END IF;

    -- Validate date (cannot be future date)
    IF p_item_date > CURRENT_DATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item date cannot be in the future.';
    END IF;

    INSERT INTO Items (
        user_id, category_id, location_id, item_type,
        title, description, item_date, image_url, status
    ) VALUES (
        p_user_id, p_category_id, p_location_id, p_item_type,
        TRIM(p_title), p_description, p_item_date, p_image_url, 'OPEN'
    );

    SET p_item_id = LAST_INSERT_ID();
END proc_label$$

-- ---------------------------------------------------------------------
-- Procedure 2: SubmitClaim
-- Creates an ownership claim for a FOUND item with validation
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS SubmitClaim$$
CREATE PROCEDURE SubmitClaim(
    IN p_item_id INT,
    IN p_claimant_id INT,
    IN p_claim_message TEXT,
    OUT p_claim_id INT
)
proc_label: BEGIN
    DECLARE v_item_type VARCHAR(10);
    DECLARE v_item_status VARCHAR(20);
    DECLARE v_owner_id INT;
    DECLARE v_existing_count INT;

    -- Check if item exists
    SELECT item_type, status, user_id INTO v_item_type, v_item_status, v_owner_id
    FROM Items WHERE item_id = p_item_id;

    IF v_item_type IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Target item does not exist.';
    END IF;

    -- Only FOUND items can be claimed
    IF v_item_type <> 'FOUND' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only found items can be claimed.';
    END IF;

    -- Item must be OPEN or CLAIM_PENDING
    IF v_item_status NOT IN ('OPEN', 'CLAIM_PENDING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is not currently available for claiming.';
    END IF;

    -- Finder cannot claim their own found report
    IF v_owner_id = p_claimant_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot submit a claim for an item you reported as found.';
    END IF;

    -- Validate claimant exists
    IF NOT EXISTS (SELECT 1 FROM Users WHERE user_id = p_claimant_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid claimant user ID.';
    END IF;

    -- Prevent duplicate pending claims by the same claimant on this item
    SELECT COUNT(*) INTO v_existing_count
    FROM Claims
    WHERE item_id = p_item_id AND claimant_id = p_claimant_id AND claim_status = 'PENDING';

    IF v_existing_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You already have a pending claim for this item.';
    END IF;

    IF p_claim_message IS NULL OR TRIM(p_claim_message) = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Please provide details proving ownership in your claim message.';
    END IF;

    INSERT INTO Claims (item_id, claimant_id, claim_message, claim_status)
    VALUES (p_item_id, p_claimant_id, TRIM(p_claim_message), 'PENDING');

    SET p_claim_id = LAST_INSERT_ID();

    -- Note: Trigger `after_claim_insert` will update Item status to CLAIM_PENDING automatically.
END proc_label$$

-- ---------------------------------------------------------------------
-- Procedure 3: ApproveClaim
-- Approves an eligible claim and sets item status using transaction
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS ApproveClaim$$
CREATE PROCEDURE ApproveClaim(
    IN p_claim_id INT,
    IN p_admin_id INT,
    IN p_admin_note TEXT
)
proc_label: BEGIN
    DECLARE v_item_id INT;
    DECLARE v_claim_status VARCHAR(20);
    DECLARE v_admin_role VARCHAR(20);

    -- Exit on error with rollback
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Verify admin identity
    SELECT role INTO v_admin_role FROM Users WHERE user_id = p_admin_id;
    IF v_admin_role <> 'ADMIN' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only authorized administrators can approve claims.';
    END IF;

    -- Retrieve claim
    SELECT item_id, claim_status INTO v_item_id, v_claim_status
    FROM Claims WHERE claim_id = p_claim_id;

    IF v_item_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim not found.';
    END IF;

    IF v_claim_status <> 'PENDING' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending claims can be approved.';
    END IF;

    START TRANSACTION;

        -- Approve target claim
        UPDATE Claims
        SET claim_status = 'APPROVED',
            admin_note = CONCAT(IFNULL(p_admin_note, 'Approved by Administrator.'), ' [Reviewer ID: ', p_admin_id, ']')
        WHERE claim_id = p_claim_id;

        -- Ensure item status is CLAIM_PENDING awaiting physical handover
        UPDATE Items
        SET status = 'CLAIM_PENDING'
        WHERE item_id = v_item_id;

        -- Automatically reject other pending claims for this item
        UPDATE Claims
        SET claim_status = 'REJECTED',
            admin_note = 'Another ownership claim was approved for this item.'
        WHERE item_id = v_item_id AND claim_id <> p_claim_id AND claim_status = 'PENDING';

    COMMIT;
END proc_label$$

-- ---------------------------------------------------------------------
-- Procedure 4: RejectClaim
-- Rejects a claim, stores admin notes, and reverts item to OPEN if no other pending claims
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS RejectClaim$$
CREATE PROCEDURE RejectClaim(
    IN p_claim_id INT,
    IN p_admin_id INT,
    IN p_admin_note TEXT
)
proc_label: BEGIN
    DECLARE v_item_id INT;
    DECLARE v_claim_status VARCHAR(20);
    DECLARE v_admin_role VARCHAR(20);
    DECLARE v_other_pending INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- Verify admin
    SELECT role INTO v_admin_role FROM Users WHERE user_id = p_admin_id;
    IF v_admin_role <> 'ADMIN' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only authorized administrators can reject claims.';
    END IF;

    -- Retrieve claim
    SELECT item_id, claim_status INTO v_item_id, v_claim_status
    FROM Claims WHERE claim_id = p_claim_id;

    IF v_item_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim not found.';
    END IF;

    IF v_claim_status <> 'PENDING' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending claims can be rejected.';
    END IF;

    START TRANSACTION;

        UPDATE Claims
        SET claim_status = 'REJECTED',
            admin_note = CONCAT(IFNULL(p_admin_note, 'Claim rejected by administrator.'), ' [Reviewer ID: ', p_admin_id, ']')
        WHERE claim_id = p_claim_id;

        -- Check if any other pending claims exist for this item
        SELECT COUNT(*) INTO v_other_pending
        FROM Claims
        WHERE item_id = v_item_id AND claim_status IN ('PENDING', 'APPROVED');

        -- If no active or approved claims remain, revert item status back to OPEN
        IF v_other_pending = 0 THEN
            UPDATE Items
            SET status = 'OPEN'
            WHERE item_id = v_item_id AND status = 'CLAIM_PENDING';
        END IF;

    COMMIT;
END proc_label$$

-- ---------------------------------------------------------------------
-- Procedure 5: GenerateItemMatches
-- Multi-criteria rule-based matching between LOST and FOUND items
-- Scoring:
--   - Same Category: 40 pts
--   - Date Proximity (<=3 days: 25 pts, <=7 days: 15 pts, <=14 days: 10 pts)
--   - Same Location: 20 pts, Same Building: 10 pts
--   - Keyword overlap in title/description: up to 15 pts
-- Inserts or updates matches where score >= 35
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS GenerateItemMatches$$
CREATE PROCEDURE GenerateItemMatches(
    OUT p_matches_created INT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    INSERT INTO ItemMatches (lost_item_id, found_item_id, match_score, match_status)
    SELECT
        l.item_id AS lost_item_id,
        f.item_id AS found_item_id,
        LEAST(100.00,
            -- Category match (40 pts)
            (CASE WHEN l.category_id = f.category_id THEN 40.00 ELSE 0.00 END) +
            -- Date proximity (up to 25 pts)
            (CASE
                WHEN ABS(DATEDIFF(l.item_date, f.item_date)) <= 3 THEN 25.00
                WHEN ABS(DATEDIFF(l.item_date, f.item_date)) <= 7 THEN 15.00
                WHEN ABS(DATEDIFF(l.item_date, f.item_date)) <= 14 THEN 10.00
                ELSE 0.00
            END) +
            -- Location match (up to 20 pts)
            (CASE
                WHEN l.location_id = f.location_id THEN 20.00
                WHEN loc_l.building_name IS NOT NULL
                     AND loc_l.building_name = loc_f.building_name THEN 10.00
                ELSE 0.00
            END) +
            -- Keyword / Title similarity (up to 15 pts)
            (CASE
                WHEN LOWER(l.title) = LOWER(f.title) THEN 15.00
                WHEN LOWER(l.title) LIKE CONCAT('%', LOWER(f.title), '%')
                  OR LOWER(f.title) LIKE CONCAT('%', LOWER(l.title), '%') THEN 10.00
                ELSE 0.00
            END)
        ) AS calculated_score,
        'SUGGESTED' AS match_status
    FROM Items l
    CROSS JOIN Items f
    INNER JOIN Locations loc_l ON l.location_id = loc_l.location_id
    INNER JOIN Locations loc_f ON f.location_id = loc_f.location_id
    WHERE l.item_type = 'LOST'
      AND f.item_type = 'FOUND'
      AND l.status IN ('OPEN', 'CLAIM_PENDING')
      AND f.status IN ('OPEN', 'CLAIM_PENDING')
      AND l.user_id <> f.user_id
      AND l.category_id = f.category_id
      AND ABS(DATEDIFF(l.item_date, f.item_date)) <= 30
    HAVING calculated_score >= 35.00
    ON DUPLICATE KEY UPDATE
        match_score = VALUES(match_score);

    SELECT ROW_COUNT() INTO v_count;
    SET p_matches_created = GREATEST(v_count, 0);
END$$

-- ---------------------------------------------------------------------
-- Procedure 6: GenerateMonthlyReport
-- Returns monthly statistics for reporting & administrative decision making
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS GenerateMonthlyReport$$
CREATE PROCEDURE GenerateMonthlyReport(
    IN p_year INT,
    IN p_month INT
)
BEGIN
    SELECT
        p_year AS report_year,
        p_month AS report_month,
        COUNT(CASE WHEN item_type = 'LOST' THEN 1 END) AS total_lost_reports,
        COUNT(CASE WHEN item_type = 'FOUND' THEN 1 END) AS total_found_reports,
        COUNT(CASE WHEN status = 'CLAIMED' THEN 1 END) AS total_recovered_items,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) AS total_active_open,
        ROUND(
            (COUNT(CASE WHEN status = 'CLAIMED' THEN 1 END) * 100.0) /
            NULLIF(COUNT(*), 0),
            2
        ) AS recovery_rate_percentage
    FROM Items
    WHERE YEAR(created_at) = p_year
      AND (p_month IS NULL OR MONTH(created_at) = p_month);
END$$

-- ---------------------------------------------------------------------
-- Procedure 7: RecordItemHandover
-- Records verified recovery handover, enforces 1-to-1 integrity,
-- and updates item status to CLAIMED in a transactional block.
-- ---------------------------------------------------------------------
DROP PROCEDURE IF EXISTS RecordItemHandover$$
CREATE PROCEDURE RecordItemHandover(
    IN p_item_id INT,
    IN p_claim_id INT,
    IN p_admin_id INT,
    IN p_remarks TEXT,
    OUT p_handover_id INT
)
proc_label: BEGIN
    DECLARE v_admin_role VARCHAR(20);
    DECLARE v_claim_status VARCHAR(20);
    DECLARE v_claim_item_id INT;
    DECLARE v_item_status VARCHAR(20);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    -- 1. Validate administrator privileges
    SELECT role INTO v_admin_role FROM Users WHERE user_id = p_admin_id;
    IF v_admin_role IS NULL OR v_admin_role <> 'ADMIN' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only administrators are authorized to execute handovers.';
    END IF;

    -- 2. Validate claim existence and status
    SELECT claim_status, item_id INTO v_claim_status, v_claim_item_id
    FROM Claims WHERE claim_id = p_claim_id;

    IF v_claim_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Specified claim does not exist.';
    END IF;

    IF v_claim_status <> 'APPROVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only approved claims can proceed to item handover.';
    END IF;

    IF v_claim_item_id <> p_item_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim does not match the designated item.';
    END IF;

    -- 3. Check for existing handover on this item or claim
    IF EXISTS (SELECT 1 FROM HandoverRecords WHERE item_id = p_item_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A handover has already been recorded for this item.';
    END IF;

    IF EXISTS (SELECT 1 FROM HandoverRecords WHERE claim_id = p_claim_id) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A handover has already been recorded for this claim.';
    END IF;

    START TRANSACTION;

        -- Insert handover record
        INSERT INTO HandoverRecords (item_id, claim_id, handed_over_by, handover_date, remarks)
        VALUES (p_item_id, p_claim_id, p_admin_id, NOW(), p_remarks);

        SET p_handover_id = LAST_INSERT_ID();

        -- Update item status to CLAIMED
        UPDATE Items
        SET status = 'CLAIMED'
        WHERE item_id = p_item_id;

        -- Update any associated ItemMatches to CONFIRMED
        UPDATE ItemMatches
        SET match_status = 'CONFIRMED'
        WHERE found_item_id = p_item_id OR lost_item_id = p_item_id;

    COMMIT;
END proc_label$$

DELIMITER ;
