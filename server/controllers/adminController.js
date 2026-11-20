const { pool } = require('../config/db');

// Dashboard Overview Statistics (Utilizes Stored Functions & Aggregates)
async function getDashboardStats(req, res, next) {
  try {
    // 1. Stored Function call: CountOpenItems()
    const [[openItemsResult]] = await pool.query('SELECT CountOpenItems() AS open_count');
    const openItemsCount = openItemsResult.open_count || 0;

    // 2. High-level aggregates
    const [[userCounts]] = await pool.query(
      `SELECT
         COUNT(CASE WHEN role = 'STUDENT' THEN 1 END) AS total_students,
         COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) AS total_admins
       FROM Users`
    );

    const [[itemCounts]] = await pool.query(
      `SELECT
         COUNT(CASE WHEN item_type = 'LOST' THEN 1 END) AS total_lost,
         COUNT(CASE WHEN item_type = 'FOUND' THEN 1 END) AS total_found,
         COUNT(CASE WHEN status = 'CLAIMED' THEN 1 END) AS total_claimed,
         COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) AS total_closed,
         COUNT(*) AS total_items
       FROM Items`
    );

    const [[claimCounts]] = await pool.query(
      `SELECT
         COUNT(CASE WHEN claim_status = 'PENDING' THEN 1 END) AS pending_claims,
         COUNT(CASE WHEN claim_status = 'APPROVED' THEN 1 END) AS approved_claims,
         COUNT(CASE WHEN claim_status = 'REJECTED' THEN 1 END) AS rejected_claims,
         COUNT(*) AS total_claims
       FROM Claims`
    );

    const [[handoverCount]] = await pool.query('SELECT COUNT(*) AS total_handovers FROM HandoverRecords');

    const totalRecovered = handoverCount.total_handovers || itemCounts.total_claimed || 0;
    const recoveryPercentage = itemCounts.total_items > 0
      ? ((totalRecovered / itemCounts.total_items) * 100).toFixed(1)
      : '0.0';

    // 3. Category distribution using stored function GetCategoryItemCount
    const [categories] = await pool.query(
      `SELECT
         category_id,
         category_name,
         GetCategoryItemCount(category_id) AS item_count
       FROM Categories
       ORDER BY item_count DESC`
    );

    // 4. Recent Activity (Query 11: UNION ALL)
    const [activity] = await pool.query(
      `(
         SELECT
           i.created_at AS event_time,
           CONCAT('Reported [', i.item_type, ']: ', i.title) AS title,
           u.name AS actor,
           'ITEM' AS type,
           i.item_id AS reference_id
         FROM Items i
         INNER JOIN Users u ON i.user_id = u.user_id
       )
       UNION ALL
       (
         SELECT
           c.created_at AS event_time,
           CONCAT('Claim on: ', i.title, ' (', c.claim_status, ')') AS title,
           u.name AS actor,
           'CLAIM' AS type,
           c.claim_id AS reference_id
         FROM Claims c
         INNER JOIN Items i ON c.item_id = i.item_id
         INNER JOIN Users u ON c.claimant_id = u.user_id
       )
       UNION ALL
       (
         SELECT
           hr.handover_date AS event_time,
           CONCAT('Handover: ', i.title) AS title,
           u.name AS actor,
           'HANDOVER' AS type,
           hr.handover_id AS reference_id
         FROM HandoverRecords hr
         INNER JOIN Items i ON hr.item_id = i.item_id
         INNER JOIN Users u ON hr.handed_over_by = u.user_id
       )
       ORDER BY event_time DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      stats: {
        total_students: userCounts.total_students || 0,
        total_admins: userCounts.total_admins || 0,
        total_lost: itemCounts.total_lost || 0,
        total_found: itemCounts.total_found || 0,
        total_open: openItemsCount,
        total_recovered: totalRecovered,
        recovery_percentage: recoveryPercentage,
        pending_claims: claimCounts.pending_claims || 0,
        approved_claims: claimCounts.approved_claims || 0,
        rejected_claims: claimCounts.rejected_claims || 0,
        total_claims: claimCounts.total_claims || 0
      },
      categories,
      activity
    });
  } catch (error) {
    next(error);
  }
}

// User Management (List Users with Stored Function stats)
async function getUsers(req, res, next) {
  try {
    const { role, search } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (role && ['STUDENT', 'ADMIN'].includes(role.toUpperCase())) {
      conditions.push('u.role = ?');
      params.push(role.toUpperCase());
    }

    if (search && search.trim()) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const [users] = await pool.query(
      `SELECT
         u.user_id,
         u.name,
         u.email,
         u.role,
         u.created_at,
         CountUserItems(u.user_id) AS items_reported,
         GetUserRecoveryCount(u.user_id) AS items_recovered
       FROM Users u
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.created_at DESC`,
      params
    );

    return res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

// Toggle User Role (Student <-> Admin)
async function updateUserRole(req, res, next) {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;

    if (!['STUDENT', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    // Prevent removing admin privileges from the last admin
    if (role === 'STUDENT') {
      const [[{ admin_count }]] = await pool.query('SELECT COUNT(*) AS admin_count FROM Users WHERE role = "ADMIN"');
      if (admin_count <= 1) {
        return res.status(400).json({ success: false, message: 'Cannot demote the last remaining administrator.' });
      }
    }

    await pool.query('UPDATE Users SET role = ? WHERE user_id = ?', [role, userId]);
    return res.json({ success: true, message: `User role updated to ${role}.` });
  } catch (error) {
    next(error);
  }
}

// Category Management
async function getCategories(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         c.category_id,
         c.category_name,
         c.description,
         GetCategoryItemCount(c.category_id) AS item_count
       FROM Categories c
       ORDER BY c.category_name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { category_name, description } = req.body;
    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name is required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Categories (category_name, description) VALUES (?, ?)',
      [category_name.trim(), description ? description.trim() : null]
    );

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      category_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const { category_name, description } = req.body;

    if (!category_name || !category_name.trim()) {
      return res.status(400).json({ success: false, message: 'Category name cannot be empty.' });
    }

    await pool.query(
      'UPDATE Categories SET category_name = ?, description = ? WHERE category_id = ?',
      [category_name.trim(), description ? description.trim() : null, categoryId]
    );

    return res.json({ success: true, message: 'Category updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    const [[{ item_count }]] = await pool.query('SELECT COUNT(*) AS item_count FROM Items WHERE category_id = ?', [categoryId]);

    if (item_count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category: ${item_count} items are linked to it. Reassign items first.`
      });
    }

    await pool.query('DELETE FROM Categories WHERE category_id = ?', [categoryId]);
    return res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

// Location Management
async function getLocations(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         l.location_id,
         l.location_name,
         l.building_name,
         l.floor_number,
         l.description,
         COUNT(i.item_id) AS item_count
       FROM Locations l
       LEFT JOIN Items i ON l.location_id = i.location_id
       GROUP BY l.location_id, l.location_name, l.building_name, l.floor_number, l.description
       ORDER BY l.location_name ASC`
    );
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

async function createLocation(req, res, next) {
  try {
    const { location_name, building_name, floor_number, description } = req.body;
    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ success: false, message: 'Location name is required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO Locations (location_name, building_name, floor_number, description) VALUES (?, ?, ?, ?)',
      [location_name.trim(), building_name ? building_name.trim() : null, floor_number ? floor_number.trim() : null, description ? description.trim() : null]
    );

    return res.status(201).json({
      success: true,
      message: 'Location added successfully.',
      location_id: result.insertId
    });
  } catch (error) {
    next(error);
  }
}

async function updateLocation(req, res, next) {
  try {
    const locationId = parseInt(req.params.id, 10);
    const { location_name, building_name, floor_number, description } = req.body;

    if (!location_name || !location_name.trim()) {
      return res.status(400).json({ success: false, message: 'Location name is required.' });
    }

    await pool.query(
      'UPDATE Locations SET location_name = ?, building_name = ?, floor_number = ?, description = ? WHERE location_id = ?',
      [location_name.trim(), building_name ? building_name.trim() : null, floor_number ? floor_number.trim() : null, description ? description.trim() : null, locationId]
    );

    return res.json({ success: true, message: 'Location updated successfully.' });
  } catch (error) {
    next(error);
  }
}

async function deleteLocation(req, res, next) {
  try {
    const locationId = parseInt(req.params.id, 10);
    const [[{ item_count }]] = await pool.query('SELECT COUNT(*) AS item_count FROM Items WHERE location_id = ?', [locationId]);

    if (item_count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete location: ${item_count} items are associated with this location.`
      });
    }

    await pool.query('DELETE FROM Locations WHERE location_id = ?', [locationId]);
    return res.json({ success: true, message: 'Location deleted successfully.' });
  } catch (error) {
    next(error);
  }
}

// Advanced SQL Reports & Analytics (Calls Stored Procedure GenerateMonthlyReport & Test Queries)
async function getReports(req, res, next) {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const month = req.query.month ? parseInt(req.query.month, 10) : null;

    // 1. Call Stored Procedure GenerateMonthlyReport
    const [monthlyStatsResult] = await pool.query('CALL GenerateMonthlyReport(?, ?)', [year, month]);
    const monthlySummary = monthlyStatsResult[0] || [];

    // 2. Query 5: Category reporting trends & recovery rate
    const [categoryBreakdown] = await pool.query(
      `SELECT
         c.category_name,
         COUNT(i.item_id) AS total_reports,
         SUM(CASE WHEN i.item_type = 'LOST' THEN 1 ELSE 0 END) AS lost_count,
         SUM(CASE WHEN i.item_type = 'FOUND' THEN 1 ELSE 0 END) AS found_count,
         SUM(CASE WHEN i.status = 'CLAIMED' THEN 1 ELSE 0 END) AS recovered_count,
         ROUND((SUM(CASE WHEN i.status = 'CLAIMED' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(i.item_id), 0), 1) AS recovery_rate
       FROM Categories c
       LEFT JOIN Items i ON c.category_id = i.category_id
       GROUP BY c.category_id, c.category_name
       ORDER BY total_reports DESC`
    );

    // 3. Query 8: Monthly reporting trends using CTE
    const [monthlyTrends] = await pool.query(
      `WITH MonthlyReportCTE AS (
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
         ROUND((recovered_items * 100.0) / NULLIF(total_items, 0), 1) AS recovery_rate
       FROM MonthlyReportCTE
       ORDER BY report_month DESC
       LIMIT 12`
    );

    // 4. Query 9: Active Students using Window Function (DENSE_RANK)
    const [activeStudents] = await pool.query(
      `WITH StudentActivityCTE AS (
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
       ORDER BY rank_position ASC
       LIMIT 10`
    );

    // 5. Query 6: Items with No Claims (Unclaimed Found Items)
    const [unclaimedItems] = await pool.query(
      `SELECT
         i.item_id,
         i.title,
         i.item_date,
         c.category_name,
         l.location_name
       FROM Items i
       INNER JOIN Categories c ON i.category_id = c.category_id
       INNER JOIN Locations l ON i.location_id = l.location_id
       WHERE i.item_type = 'FOUND'
         AND NOT EXISTS (SELECT 1 FROM Claims cl WHERE cl.item_id = i.item_id)
       ORDER BY i.item_date DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      monthlySummary,
      categoryBreakdown,
      monthlyTrends,
      activeStudents,
      unclaimedItems
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDashboardStats,
  getUsers,
  updateUserRole,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  getReports
};
