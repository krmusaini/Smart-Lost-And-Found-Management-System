const { pool } = require('../config/db');

// Get Matches for Logged-in Student
async function getMyMatches(req, res, next) {
  try {
    const userId = req.session.user.user_id;

    const [matches] = await pool.query(
      `SELECT
         m.match_id,
         m.match_score,
         m.match_status,
         m.created_at,
         -- Lost Item details
         l.item_id AS lost_item_id,
         l.title AS lost_title,
         l.description AS lost_description,
         l.item_date AS lost_date,
         l.user_id AS lost_reporter_id,
         -- Found Item details
         f.item_id AS found_item_id,
         f.title AS found_title,
         f.description AS found_description,
         f.item_date AS found_date,
         f.user_id AS found_reporter_id,
         f.image_url AS found_image_url,
         -- Category and Location
         c.category_name,
         loc_l.location_name AS lost_location_name,
         loc_f.location_name AS found_location_name
       FROM ItemMatches m
       INNER JOIN Items l ON m.lost_item_id = l.item_id
       INNER JOIN Items f ON m.found_item_id = f.item_id
       INNER JOIN Categories c ON l.category_id = c.category_id
       INNER JOIN Locations loc_l ON l.location_id = loc_l.location_id
       INNER JOIN Locations loc_f ON f.location_id = loc_f.location_id
       WHERE (l.user_id = ? OR f.user_id = ?)
         AND m.match_status <> 'DISMISSED'
       ORDER BY m.match_score DESC, m.created_at DESC`,
      [userId, userId]
    );

    // Format response to identify whether current user reported the lost or found item
    const formatted = matches.map(m => {
      const isLostReporter = m.lost_reporter_id === userId;
      return {
        match_id: m.match_id,
        match_score: m.match_score,
        match_status: m.match_status,
        created_at: m.created_at,
        category_name: m.category_name,
        my_item_type: isLostReporter ? 'LOST' : 'FOUND',
        my_item_id: isLostReporter ? m.lost_item_id : m.found_item_id,
        my_item_title: isLostReporter ? m.lost_title : m.found_title,
        matched_item_type: isLostReporter ? 'FOUND' : 'LOST',
        matched_item_id: isLostReporter ? m.found_item_id : m.lost_item_id,
        matched_item_title: isLostReporter ? m.found_title : m.lost_title,
        matched_item_description: isLostReporter ? m.found_description : m.lost_description,
        matched_item_date: isLostReporter ? m.found_date : m.lost_date,
        matched_item_location: isLostReporter ? m.found_location_name : m.lost_location_name,
        matched_image_url: isLostReporter ? m.found_image_url : null
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
}

// Admin: Get All System Matches
async function getAllMatches(req, res, next) {
  try {
    const { status } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (status && ['SUGGESTED', 'CONFIRMED', 'DISMISSED'].includes(status.toUpperCase())) {
      conditions.push('m.match_status = ?');
      params.push(status.toUpperCase());
    }

    const [matches] = await pool.query(
      `SELECT
         m.match_id,
         m.match_score,
         m.match_status,
         m.created_at,
         l.item_id AS lost_item_id,
         l.title AS lost_title,
         l.item_date AS lost_date,
         u_lost.name AS lost_reporter_name,
         u_lost.email AS lost_reporter_email,
         f.item_id AS found_item_id,
         f.title AS found_title,
         f.item_date AS found_date,
         u_found.name AS found_reporter_name,
         u_found.email AS found_reporter_email,
         c.category_name,
         loc_l.location_name AS lost_location,
         loc_f.location_name AS found_location
       FROM ItemMatches m
       INNER JOIN Items l ON m.lost_item_id = l.item_id
       INNER JOIN Items f ON m.found_item_id = f.item_id
       INNER JOIN Categories c ON l.category_id = c.category_id
       INNER JOIN Locations loc_l ON l.location_id = loc_l.location_id
       INNER JOIN Locations loc_f ON f.location_id = loc_f.location_id
       INNER JOIN Users u_lost ON l.user_id = u_lost.user_id
       INNER JOIN Users u_found ON f.user_id = u_found.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.match_score DESC, m.created_at DESC`,
      params
    );

    return res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
}

// Trigger Smart Matching Procedure
async function triggerMatching(req, res, next) {
  try {
    const [result] = await pool.query(
      `CALL GenerateItemMatches(@match_count);
       SELECT @match_count AS matches_created;`
    );

    const selectOutput = Array.isArray(result) ? result.find(r => Array.isArray(r) && r[0]?.matches_created !== undefined) : null;
    const matchesCreated = selectOutput ? selectOutput[0].matches_created : (result[result.length - 1]?.[0]?.matches_created || 0);

    return res.json({
      success: true,
      message: 'Matching algorithm executed successfully.',
      matches_created: matchesCreated
    });
  } catch (error) {
    next(error);
  }
}

// Admin: Update Match Status (CONFIRM or DISMISS)
async function updateMatchStatus(req, res, next) {
  try {
    const matchId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['SUGGESTED', 'CONFIRMED', 'DISMISSED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid match status.' });
    }

    await pool.query('UPDATE ItemMatches SET match_status = ? WHERE match_id = ?', [status, matchId]);
    return res.json({ success: true, message: `Match status updated to ${status}.` });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getMyMatches,
  getAllMatches,
  triggerMatching,
  updateMatchStatus
};
