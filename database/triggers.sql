-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Triggers
-- Target: MySQL 8.0+
-- =====================================================================

USE smart_lost_found_db;

DELIMITER $$

-- ---------------------------------------------------------------------
-- Trigger 1: trg_after_claim_insert
-- When a new claim is submitted with status 'PENDING',
-- transition the item's status from 'OPEN' to 'CLAIM_PENDING'.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_claim_insert$$
CREATE TRIGGER trg_after_claim_insert
AFTER INSERT ON Claims
FOR EACH ROW
BEGIN
    IF NEW.claim_status = 'PENDING' THEN
        UPDATE Items
        SET status = 'CLAIM_PENDING'
        WHERE item_id = NEW.item_id AND status = 'OPEN';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Trigger 2: trg_before_claim_update
-- Enforces valid claim status transitions:
-- - A claim that is already 'APPROVED' or 'REJECTED' cannot be reverted to 'PENDING'.
-- - Prevents modifying claimant or item on existing claims.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_before_claim_update$$
CREATE TRIGGER trg_before_claim_update
BEFORE UPDATE ON Claims
FOR EACH ROW
BEGIN
    -- Prevent altering historical relationships
    IF OLD.item_id <> NEW.item_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity violation: item_id cannot be changed once claim is registered.';
    END IF;

    IF OLD.claimant_id <> NEW.claimant_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity violation: claimant_id cannot be altered.';
    END IF;

    -- Prevent reviving finalized claims
    IF OLD.claim_status IN ('APPROVED', 'REJECTED') AND NEW.claim_status = 'PENDING' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Invalid state transition: A finalized claim cannot be reverted to pending.';
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Trigger 3: trg_after_claim_update
-- When a claim transitions from PENDING to APPROVED, ensure the item
-- status remains in CLAIM_PENDING state waiting for handover.
-- If all claims for an item are REJECTED, revert item status to OPEN.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_claim_update$$
CREATE TRIGGER trg_after_claim_update
AFTER UPDATE ON Claims
FOR EACH ROW
BEGIN
    DECLARE v_active_count INT DEFAULT 0;

    IF OLD.claim_status <> NEW.claim_status THEN
        IF NEW.claim_status = 'APPROVED' THEN
            UPDATE Items
            SET status = 'CLAIM_PENDING'
            WHERE item_id = NEW.item_id AND status <> 'CLAIMED';
        ELSEIF NEW.claim_status = 'REJECTED' THEN
            -- Check if any other claims remain pending or approved
            SELECT COUNT(*) INTO v_active_count
            FROM Claims
            WHERE item_id = NEW.item_id
              AND claim_status IN ('PENDING', 'APPROVED');

            -- Revert back to OPEN if no claims remain
            IF v_active_count = 0 THEN
                UPDATE Items
                SET status = 'OPEN'
                WHERE item_id = NEW.item_id AND status = 'CLAIM_PENDING';
            END IF;
        END IF;
    END IF;
END$$

-- ---------------------------------------------------------------------
-- Trigger 4: trg_after_handover_insert
-- When a handover is officially recorded in HandoverRecords,
-- transition the item's status to 'CLAIMED'.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_handover_insert$$
CREATE TRIGGER trg_after_handover_insert
AFTER INSERT ON HandoverRecords
FOR EACH ROW
BEGIN
    UPDATE Items
    SET status = 'CLAIMED'
    WHERE item_id = NEW.item_id;
END$$

DELIMITER ;
