-- =====================================================================
-- SMART STUDENT LOST & FOUND MANAGEMENT SYSTEM
-- Complex SQL Queries, Analytics & Capstone Demonstrations
-- Demonstrating: Joins, Aggregates, Subqueries, CTEs, Window Functions,
-- Unions, Views, and Index Optimization
-- =====================================================================

USE smart_lost_found_db;

-- =====================================================================
-- QUERY 1: Display all currently open lost items with reporter and location details
-- Demonstrates: INNER JOIN, WHERE filter, ORDER BY
-- =====================================================================
SELECT
    i.item_id,
    i.title,
    i.description,
    i.item_date,
    c.category_name,
    l.location_name,
    l.building_name,
    u.name AS student_name,
    u.email AS student_email
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
INNER JOIN Users u ON i.user_id = u.user_id
WHERE i.item_type = 'LOST' AND i.status = 'OPEN'
ORDER BY i.item_date DESC;

-- =====================================================================
-- QUERY 2: Display all found items with category, location and pending claim counts
-- Demonstrates: LEFT JOIN, GROUP BY, Aggregate functions (COUNT)
-- =====================================================================
SELECT
    i.item_id,
    i.title,
    i.item_date,
    i.status,
    c.category_name,
    CONCAT(l.location_name, ' (', l.building_name, ', ', l.floor_number, ')') AS full_location,
    finder.name AS found_by,
    COUNT(cl.claim_id) AS total_claims_received
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
INNER JOIN Users finder ON i.user_id = finder.user_id
LEFT JOIN Claims cl ON i.item_id = cl.item_id
WHERE i.item_type = 'FOUND'
GROUP BY i.item_id, i.title, i.item_date, i.status, c.category_name, full_location, finder.name
ORDER BY i.created_at DESC;

-- =====================================================================
-- QUERY 3: Find all reports submitted by a particular student (e.g., student_id = 2)
-- Demonstrates: Stored Function integration and correlated status check
-- =====================================================================
SELECT
    i.item_id,
    i.item_type,
    i.title,
    i.item_date,
    i.status,
    c.category_name,
    l.location_name,
    CountUserItems(i.user_id) AS total_lifetime_reports_by_student
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
WHERE i.user_id = 2
ORDER BY i.created_at DESC;

-- =====================================================================
-- QUERY 4: Find students who have recovered items with recovery counts
-- Demonstrates: Subquery with GROUP BY, HAVING, and INNER JOIN
-- =====================================================================
SELECT
    u.user_id,
    u.name AS student_name,
    u.email,
    COUNT(hr.handover_id) AS total_successful_recoveries
FROM Users u
INNER JOIN Claims c ON u.user_id = c.claimant_id
INNER JOIN HandoverRecords hr ON c.claim_id = hr.claim_id
GROUP BY u.user_id, u.name, u.email
HAVING COUNT(hr.handover_id) >= 1
ORDER BY total_successful_recoveries DESC;

-- =====================================================================
-- QUERY 5: Most frequently reported item categories with breakdown
-- Demonstrates: GROUP BY, Conditional Aggregation (SUM CASE), ORDER BY
-- =====================================================================
SELECT
    c.category_id,
    c.category_name,
    COUNT(i.item_id) AS total_reports,
    SUM(CASE WHEN i.item_type = 'LOST' THEN 1 ELSE 0 END) AS lost_count,
    SUM(CASE WHEN i.item_type = 'FOUND' THEN 1 ELSE 0 END) AS found_count,
    SUM(CASE WHEN i.status = 'CLAIMED' THEN 1 ELSE 0 END) AS recovered_count,
    ROUND((SUM(CASE WHEN i.status = 'CLAIMED' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(i.item_id), 0), 1) AS category_recovery_percentage
FROM Categories c
LEFT JOIN Items i ON c.category_id = i.category_id
GROUP BY c.category_id, c.category_name
ORDER BY total_reports DESC;

-- =====================================================================
-- QUERY 6: Find items that currently have NO ownership claims
-- Demonstrates: Correlated Subquery with NOT EXISTS (or LEFT JOIN WHERE IS NULL)
-- =====================================================================
SELECT
    i.item_id,
    i.item_type,
    i.title,
    i.item_date,
    c.category_name,
    l.location_name
FROM Items i
INNER JOIN Categories c ON i.category_id = c.category_id
INNER JOIN Locations l ON i.location_id = l.location_id
WHERE i.item_type = 'FOUND'
  AND NOT EXISTS (
      SELECT 1 FROM Claims cl WHERE cl.item_id = i.item_id
  )
ORDER BY i.item_date DESC;

-- =====================================================================
-- QUERY 7: Display all pending claims with claimant and item information
-- Demonstrates: Multi-table INNER JOIN, formatted dates
-- =====================================================================
SELECT
    cl.claim_id,
    cl.created_at AS claim_timestamp,
    cl.claim_message,
    i.item_id,
    i.title AS found_item_title,
    i.item_date AS date_found,
    cat.category_name,
    loc.location_name AS found_location,
    claimant.user_id AS claimant_id,
    claimant.name AS claimant_name,
    claimant.email AS claimant_email
FROM Claims cl
INNER JOIN Items i ON cl.item_id = i.item_id
INNER JOIN Categories cat ON i.category_id = cat.category_id
INNER JOIN Locations loc ON i.location_id = loc.location_id
INNER JOIN Users claimant ON cl.claimant_id = claimant.user_id
WHERE cl.claim_status = 'PENDING'
ORDER BY cl.created_at ASC;

-- =====================================================================
-- QUERY 8: Generate monthly lost and found reporting trends
-- Demonstrates: Common Table Expression (CTE) & Date grouping
-- =====================================================================
WITH MonthlyReportCTE AS (
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS report_month,
        COUNT(CASE WHEN item_type = 'LOST' THEN 1 END) AS lost_items,
        COUNT(CASE WHEN item_type = 'FOUND' THEN 1 END) AS found_items,
        COUNT(CASE WHEN status = 'CLAIMED' THEN 1 END) AS recovered_items,
        COUNT(*) AS total_items
    FROM Items
    GROUP BY DATE_FORMAT(created_at, '%Y-%m')
)
SELECT
    report_month,
    lost_items,
    found_items,
    recovered_items,
    total_items,
    ROUND((recovered_items * 100.0) / NULLIF(total_items, 0), 2) AS monthly_recovery_rate
FROM MonthlyReportCTE
ORDER BY report_month DESC;

-- =====================================================================
-- QUERY 9: Identify the most active students using Window Functions
-- Demonstrates: Window Functions (DENSE_RANK, ROW_NUMBER) over activity score
-- =====================================================================
WITH StudentActivityCTE AS (
    SELECT
        u.user_id,
        u.name AS student_name,
        u.email,
        COUNT(DISTINCT i.item_id) AS total_items_reported,
        COUNT(DISTINCT c.claim_id) AS total_claims_made
    FROM Users u
    LEFT JOIN Items i ON u.user_id = i.user_id
    LEFT JOIN Claims c ON u.user_id = c.claimant_id
    WHERE u.role = 'STUDENT'
    GROUP BY u.user_id, u.name, u.email
)
SELECT
    user_id,
    student_name,
    email,
    total_items_reported,
    total_claims_made,
    (total_items_reported + total_claims_made) AS activity_score,
    DENSE_RANK() OVER (ORDER BY (total_items_reported + total_claims_made) DESC) AS rank_position
FROM StudentActivityCTE
ORDER BY rank_position ASC;

-- =====================================================================
-- QUERY 10: Display successful handovers with student and administrator info
-- Demonstrates: Multi-way join, Audit trail query
-- =====================================================================
SELECT
    hr.handover_id,
    hr.handover_date,
    i.item_id,
    i.title AS recovered_item,
    cat.category_name,
    claimant.name AS student_recipient,
    claimant.email AS student_email,
    admin_u.name AS administrator_name,
    hr.remarks
FROM HandoverRecords hr
INNER JOIN Items i ON hr.item_id = i.item_id
INNER JOIN Categories cat ON i.category_id = cat.category_id
INNER JOIN Claims cl ON hr.claim_id = cl.claim_id
INNER JOIN Users claimant ON cl.claimant_id = claimant.user_id
INNER JOIN Users admin_u ON hr.handed_over_by = admin_u.user_id
ORDER BY hr.handover_date DESC;

-- =====================================================================
-- QUERY 11 (BONUS): Consolidated Timeline using UNION ALL
-- Demonstrates: UNION ALL combining item events, claims and handovers
-- =====================================================================
(
    SELECT
        created_at AS event_time,
        CONCAT('Item Reported: [', item_type, '] ', title) AS event_description,
        'ITEM' AS event_type
    FROM Items
)
UNION ALL
(
    SELECT
        created_at AS event_time,
        CONCAT('Ownership Claim Submitted (Status: ', claim_status, ')') AS event_description,
        'CLAIM' AS event_type
    FROM Claims
)
UNION ALL
(
    SELECT
        handover_date AS event_time,
        CONCAT('Official Handover Completed: ', remarks) AS event_description,
        'HANDOVER' AS event_type
    FROM HandoverRecords
)
ORDER BY event_time DESC
LIMIT 15;
