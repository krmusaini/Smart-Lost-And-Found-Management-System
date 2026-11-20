const { pool } = require('../config/db');

// Admin: Record Item Handover (Calls Stored Procedure RecordItemHandover)
async function recordHandover(req, res, next) {
  try {
    const adminId = req.session.user.user_id;
    const { item_id, claim_id, remarks } = req.body;

    if (!item_id || !claim_id) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and Approved Claim ID are required to record a handover.'
      });
    }

    // Call MySQL Stored Procedure RecordItemHandover
    const [result] = await pool.query(
      `CALL RecordItemHandover(?, ?, ?, ?, @new_handover_id);
       SELECT @new_handover_id AS handover_id;`,
      [
        parseInt(item_id, 10),
        parseInt(claim_id, 10),
        adminId,
        remarks ? remarks.trim() : 'Handover completed and verified at security desk.'
      ]
    );

    const selectOutput = Array.isArray(result) ? result.find(r => Array.isArray(r) && r[0]?.handover_id !== undefined) : null;
    const newHandoverId = selectOutput ? selectOutput[0].handover_id : (result[result.length - 1]?.[0]?.handover_id || null);

    return res.status(201).json({
      success: true,
      message: 'Item handover recorded successfully! Item status has been finalized to CLAIMED.',
      handover_id: newHandoverId
    });
  } catch (error) {
    next(error);
  }
}

// Admin: Get All Handovers (Reads from View v_handover_details)
async function getAllHandovers(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM v_handover_details ORDER BY handover_date DESC');
    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

// Student: Get Handovers related to logged-in user
async function getMyHandovers(req, res, next) {
  try {
    const userId = req.session.user.user_id;

    const [rows] = await pool.query(
      `SELECT * FROM v_handover_details
       WHERE claimant_id = ?
       ORDER BY handover_date DESC`,
      [userId]
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

// Admin: Get Approved Claims Ready for Handover
async function getPendingHandovers(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         c.claim_id,
         c.item_id,
         c.claimant_id,
         c.claim_message,
         c.admin_note,
         c.created_at AS claim_date,
         i.title AS item_title,
         i.item_type,
         i.item_date,
         cat.category_name,
         loc.location_name,
         u.name AS claimant_name,
         u.email AS claimant_email
       FROM Claims c
       INNER JOIN Items i ON c.item_id = i.item_id
       INNER JOIN Categories cat ON i.category_id = cat.category_id
       INNER JOIN Locations loc ON i.location_id = loc.location_id
       INNER JOIN Users u ON c.claimant_id = u.user_id
       LEFT JOIN HandoverRecords hr ON c.claim_id = hr.claim_id
       WHERE c.claim_status = 'APPROVED'
         AND hr.handover_id IS NULL
       ORDER BY c.created_at ASC`
    );

    return res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordHandover,
  getAllHandovers,
  getMyHandovers,
  getPendingHandovers
};
