const { pool } = require('../config/db');

// Create Item using Stored Procedure SubmitItemReport
async function createItem(req, res, next) {
  try {
    const userId = req.session.user.user_id;
    const { category_id, location_id, item_type, title, description, item_date } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!category_id || !location_id || !item_type || !title || !item_date) {
      return res.status(400).json({
        success: false,
        message: 'Category, location, type, title, and date are required.'
      });
    }

    // Call MySQL Stored Procedure SubmitItemReport
    const [result] = await pool.query(
      `CALL SubmitItemReport(?, ?, ?, ?, ?, ?, ?, ?, @new_item_id);
       SELECT @new_item_id AS item_id;`,
      [
        userId,
        parseInt(category_id, 10),
        parseInt(location_id, 10),
        item_type.toUpperCase(),
        title.trim(),
        description ? description.trim() : null,
        item_date,
        imageUrl
      ]
    );

    // Retrieve output parameter
    const selectOutput = Array.isArray(result) ? result.find(r => Array.isArray(r) && r[0]?.item_id !== undefined) : null;
    const newItemId = selectOutput ? selectOutput[0].item_id : (result[result.length - 1]?.[0]?.item_id || null);

    // Run matching procedure in background to discover potential matches
    pool.query('CALL GenerateItemMatches(@match_count);').catch(err => {
      console.warn('[Matching Background Routine Error]', err.message);
    });

    return res.status(201).json({
      success: true,
      message: `${item_type === 'LOST' ? 'Lost' : 'Found'} item reported successfully!`,
      item_id: newItemId
    });
  } catch (error) {
    next(error);
  }
}

// Search and Filter Items
async function getItems(req, res, next) {
  try {
    const {
      q,
      type,
      category_id,
      location_id,
      status,
      date_from,
      date_to,
      page = 1,
      limit = 12
    } = req.query;

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const conditions = ['1=1'];
    const params = [];

    if (q && q.trim()) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ?)');
      const term = `%${q.trim()}%`;
      params.push(term, term);
    }

    if (type && ['LOST', 'FOUND'].includes(type.toUpperCase())) {
      conditions.push('i.item_type = ?');
      params.push(type.toUpperCase());
    }

    if (category_id && parseInt(category_id, 10) > 0) {
      conditions.push('i.category_id = ?');
      params.push(parseInt(category_id, 10));
    }

    if (location_id && parseInt(location_id, 10) > 0) {
      conditions.push('i.location_id = ?');
      params.push(parseInt(location_id, 10));
    }

    if (status && status !== 'ALL') {
      conditions.push('i.status = ?');
      params.push(status);
    } else if (!status) {
      // By default show active open or claim_pending listings
      conditions.push('i.status IN ("OPEN", "CLAIM_PENDING")');
    }

    if (date_from) {
      conditions.push('i.item_date >= ?');
      params.push(date_from);
    }

    if (date_to) {
      conditions.push('i.item_date <= ?');
      params.push(date_to);
    }

    const whereClause = conditions.join(' AND ');

    // Count total matches for pagination
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM Items i
       WHERE ${whereClause}`,
      params
    );

    // Fetch items with joined category and location data
    const [items] = await pool.query(
      `SELECT
         i.item_id,
         i.item_type,
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
         u.name AS reporter_name
       FROM Items i
       INNER JOIN Categories c ON i.category_id = c.category_id
       INNER JOIN Locations l ON i.location_id = l.location_id
       INNER JOIN Users u ON i.user_id = u.user_id
       WHERE ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit, 10), parseInt(offset, 10)]
    );

    return res.json({
      success: true,
      data: items,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
}

// Get Item Details by ID
async function getItemById(req, res, next) {
  try {
    const itemId = parseInt(req.params.id, 10);
    const currentUserId = req.session?.user?.user_id || 0;
    const isAdmin = req.session?.user?.role === 'ADMIN';

    const [rows] = await pool.query(
      `SELECT
         i.item_id,
         i.user_id AS reporter_id,
         u.name AS reporter_name,
         u.email AS reporter_email,
         i.category_id,
         c.category_name,
         i.location_id,
         l.location_name,
         l.building_name,
         l.floor_number,
         l.description AS location_description,
         i.item_type,
         i.title,
         i.description,
         i.item_date,
         i.image_url,
         i.status,
         i.created_at
       FROM Items i
       INNER JOIN Categories c ON i.category_id = c.category_id
       INNER JOIN Locations l ON i.location_id = l.location_id
       INNER JOIN Users u ON i.user_id = u.user_id
       WHERE i.item_id = ?`,
      [itemId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    const item = rows[0];

    // Privacy mask: Only reporter or admin sees reporter's email address
    if (item.reporter_id !== currentUserId && !isAdmin) {
      delete item.reporter_email;
    }

    // Check if the current user has already submitted a claim on this item
    let userClaim = null;
    if (currentUserId > 0) {
      const [claims] = await pool.query(
        `SELECT claim_id, claim_status, claim_message, admin_note, created_at
         FROM Claims
         WHERE item_id = ? AND claimant_id = ?`,
        [itemId, currentUserId]
      );
      if (claims.length > 0) {
        userClaim = claims[0];
      }
    }

    return res.json({
      success: true,
      item,
      userClaim,
      isOwner: item.reporter_id === currentUserId
    });
  } catch (error) {
    next(error);
  }
}

// Update Item Report (Owner or Admin only)
async function updateItem(req, res, next) {
  try {
    const itemId = parseInt(req.params.id, 10);
    const userId = req.session.user.user_id;
    const isAdmin = req.session.user.role === 'ADMIN';
    const { category_id, location_id, title, description, item_date } = req.body;

    const [existing] = await pool.query('SELECT user_id, status FROM Items WHERE item_id = ?', [itemId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    if (existing[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to edit this report.' });
    }

    if (existing[0].status === 'CLAIMED') {
      return res.status(400).json({ success: false, message: 'Claimed items cannot be modified.' });
    }

    await pool.query(
      `UPDATE Items
       SET category_id = ?, location_id = ?, title = ?, description = ?, item_date = ?
       WHERE item_id = ?`,
      [
        parseInt(category_id, 10),
        parseInt(location_id, 10),
        title.trim(),
        description ? description.trim() : null,
        item_date,
        itemId
      ]
    );

    return res.json({ success: true, message: 'Item report updated successfully.' });
  } catch (error) {
    next(error);
  }
}

// Close an Open Item Report
async function closeItem(req, res, next) {
  try {
    const itemId = parseInt(req.params.id, 10);
    const userId = req.session.user.user_id;
    const isAdmin = req.session.user.role === 'ADMIN';

    const [existing] = await pool.query('SELECT user_id, status FROM Items WHERE item_id = ?', [itemId]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Item not found.' });
    }

    if (existing[0].user_id !== userId && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to close this report.' });
    }

    if (existing[0].status === 'CLAIMED') {
      return res.status(400).json({ success: false, message: 'Item is already claimed and verified.' });
    }

    await pool.query('UPDATE Items SET status = "CLOSED" WHERE item_id = ?', [itemId]);
    return res.json({ success: true, message: 'Item report has been closed.' });
  } catch (error) {
    next(error);
  }
}

// Get Logged-in User's Reports
async function getMyReports(req, res, next) {
  try {
    const userId = req.session.user.user_id;

    const [reports] = await pool.query(
      `SELECT
         i.item_id,
         i.item_type,
         i.title,
         i.description,
         i.item_date,
         i.image_url,
         i.status,
         i.created_at,
         c.category_name,
         l.location_name,
         COUNT(DISTINCT cl.claim_id) AS claim_count,
         COUNT(DISTINCT m.match_id) AS match_count
       FROM Items i
       INNER JOIN Categories c ON i.category_id = c.category_id
       INNER JOIN Locations l ON i.location_id = l.location_id
       LEFT JOIN Claims cl ON i.item_id = cl.item_id
       LEFT JOIN ItemMatches m ON (i.item_id = m.lost_item_id OR i.item_id = m.found_item_id)
       WHERE i.user_id = ?
       GROUP BY i.item_id, i.item_type, i.title, i.description, i.item_date, i.image_url, i.status, i.created_at, c.category_name, l.location_name
       ORDER BY i.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
}

// Get All Categories and Locations for Dropdown Menus
async function getMetadata(req, res, next) {
  try {
    const [categories] = await pool.query('SELECT category_id, category_name, description FROM Categories ORDER BY category_name ASC');
    const [locations] = await pool.query('SELECT location_id, location_name, building_name, floor_number, description FROM Locations ORDER BY location_name ASC');

    return res.json({
      success: true,
      categories,
      locations
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createItem,
  getItems,
  getItemById,
  updateItem,
  closeItem,
  getMyReports,
  getMetadata
};
