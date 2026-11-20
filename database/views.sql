-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Database Views (At least 3 required)
-- Target: MySQL 8.0+
-- =====================================================================

USE smart_lost_found_db;

-- ---------------------------------------------------------------------
-- View 1: v_open_lost_items
-- Surfaces all active lost item reports with normalized category,
-- location names, and reporter information for public/student discovery.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_open_lost_items AS
SELECT
    i.item_id,
    i.title,
    i.description,
    i.item_date,
    i.image_url,
    i.status,
    i.created_at,
    c.category_id,
    c.category_name,
    l.location_id,
    l.location_name,
    l.building_name,
    l.floor_number,
    u.user_id AS reporter_id,
    u.name AS reporter_name,
    u.email AS reporter_email
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
INNER JOIN Users u ON i.user_id = u.user_id
WHERE i.item_type = 'LOST' AND i.status = 'OPEN';

-- ---------------------------------------------------------------------
-- View 2: v_active_found_items
-- Surfaces all found items eligible for searching or claiming,
-- along with aggregated pending claim count.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_active_found_items AS
SELECT
    i.item_id,
    i.title,
    i.description,
    i.item_date,
    i.image_url,
    i.status,
    i.created_at,
    c.category_id,
    c.category_name,
    l.location_id,
    l.location_name,
    l.building_name,
    l.floor_number,
    u.user_id AS finder_id,
    u.name AS finder_name,
    COUNT(cl.claim_id) AS total_claims,
    COUNT(CASE WHEN cl.claim_status = 'PENDING' THEN 1 END) AS pending_claims
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
INNER JOIN Users u ON i.user_id = u.user_id
LEFT JOIN Claims cl ON i.item_id = cl.item_id
WHERE i.item_type = 'FOUND' AND i.status IN ('OPEN', 'CLAIM_PENDING')
GROUP BY
    i.item_id, i.title, i.description, i.item_date, i.image_url,
    i.status, i.created_at, c.category_id, c.category_name,
    l.location_id, l.location_name, l.building_name, l.floor_number,
    u.user_id, u.name;

-- ---------------------------------------------------------------------
-- View 3: v_handover_details
-- Complete audit trail of all verified recoveries, joining HandoverRecords,
-- Items, approved Claims, the receiving student, and the verifying admin.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_handover_details AS
SELECT
    hr.handover_id,
    hr.handover_date,
    hr.remarks AS handover_remarks,
    i.item_id,
    i.title AS item_title,
    i.item_type,
    i.item_date,
    cat.category_name,
    loc.location_name,
    loc.building_name,
    finder.name AS original_reporter_name,
    claimant.user_id AS claimant_id,
    claimant.name AS claimant_name,
    claimant.email AS claimant_email,
    admin_user.user_id AS admin_id,
    admin_user.name AS admin_name,
    admin_user.email AS admin_email,
    cl.claim_id,
    cl.claim_message,
    cl.admin_note
FROM HandoverRecords hr
INNER JOIN Items i ON hr.item_id = i.item_id
INNER JOIN Categories cat ON i.category_id = cat.category_id
INNER JOIN Locations loc ON i.location_id = loc.location_id
INNER JOIN Users finder ON i.user_id = finder.user_id
INNER JOIN Claims cl ON hr.claim_id = cl.claim_id
INNER JOIN Users claimant ON cl.claimant_id = claimant.user_id
INNER JOIN Users admin_user ON hr.handed_over_by = admin_user.user_id;
