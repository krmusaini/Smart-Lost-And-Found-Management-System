const { pool } = require('../config/db');

// Submit Ownership Claim (Calls Stored Procedure SubmitClaim)
async function submitClaim(req, res, next) {
  try {
    const claimantId = req.session.user.user_id;
    const { item_id, claim_message } = req.body;

    if (!item_id || !claim_message || !claim_message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Item ID and a detailed claim message are required.'
      });
    }

    // Call MySQL Stored Procedure SubmitClaim
    const [result] = await pool.query(
      `CALL SubmitClaim(?, ?, ?, @new_claim_id);
       SELECT @new_claim_id AS claim_id;`,
      [parseInt(item_id, 10), claimantId, claim_message.trim()]
    );

    const selectOutput = Array.isArray(result) ? result.find(r => Array.isArray(r) && r[0]?.claim_id !== undefined) : null;
    const newClaimId = selectOutput ? selectOutput[0].claim_id : (result[result.length - 1]?.[0]?.claim_id || null);

    return res.status(201).json({
      success: true,
      message: 'Your ownership claim has been submitted successfully and is pending administrator review.',
      claim_id: newClaimId
    });
  } catch (error) {
    next(error);
  }
}

// Get Student's Submitted Claims
async function getMyClaims(req, res, next) {
  try {
    const claimantId = req.session.user.user_id;

    const [claims] = await pool.query(
      `SELECT
         c.claim_id,
         c.claim_message,
         c.claim_status,
         c.admin_note,
         c.created_at AS claim_date,
         i.item_id,
         i.title AS item_title,
         i.item_date,
         i.status AS item_status,
         i.image_url,
         cat.category_name,
         loc.location_name,
         hr.handover_id,
         hr.handover_date,
         hr.remarks AS handover_remarks
       FROM Claims c
       INNER JOIN Items i ON c.item_id = i.item_id
       INNER JOIN Categories cat ON i.category_id = cat.category_id
       INNER JOIN Locations loc ON i.location_id = loc.location_id
       LEFT JOIN HandoverRecords hr ON c.claim_id = hr.claim_id
       WHERE c.claimant_id = ?
       ORDER BY c.created_at DESC`,
      [claimantId]
    );

    return res.json({ success: true, data: claims });
  } catch (error) {
    next(error);
  }
}

// Admin: Get All Claims with Filters
async function getAllClaims(req, res, next) {
  try {
    const { status, search } = req.query;
    const conditions = ['1=1'];
    const params = [];

    if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      conditions.push('c.claim_status = ?');
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      conditions.push('(i.title LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const [claims] = await pool.query(
      `SELECT
         c.claim_id,
         c.item_id,
         c.claimant_id,
         c.claim_message,
         c.claim_status,
         c.admin_note,
         c.created_at AS claim_date,
         i.title AS item_title,
         i.item_type,
         i.item_date,
         i.status AS item_status,
         cat.category_name,
         loc.location_name,
         u.name AS claimant_name,
         u.email AS claimant_email,
         hr.handover_id,
         hr.handover_date
       FROM Claims c
       INNER JOIN Items i ON c.item_id = i.item_id
       INNER JOIN Categories cat ON i.category_id = cat.category_id
       INNER JOIN Locations loc ON i.location_id = loc.location_id
       INNER JOIN Users u ON c.claimant_id = u.user_id
       LEFT JOIN HandoverRecords hr ON c.claim_id = hr.claim_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at DESC`,
      params
    );

    return res.json({ success: true, data: claims });
  } catch (error) {
    next(error);
  }
}

// Admin: Approve Claim (Calls Stored Procedure ApproveClaim)
async function approveClaim(req, res, next) {
  try {
    const claimId = parseInt(req.params.id, 10);
    const adminId = req.session.user.user_id;
    const { admin_note } = req.body;

    // Call MySQL Stored Procedure ApproveClaim
    await pool.query(
      'CALL ApproveClaim(?, ?, ?)',
      [claimId, adminId, admin_note ? admin_note.trim() : 'Approved by administrator.']
    );

    return res.json({
      success: true,
      message: 'Claim approved successfully! The item is now marked for physical handover.'
    });
  } catch (error) {
    next(error);
  }
}

// Admin: Reject Claim (Calls Stored Procedure RejectClaim)
async function rejectClaim(req, res, next) {
  try {
    const claimId = parseInt(req.params.id, 10);
    const adminId = req.session.user.user_id;
    const { admin_note } = req.body;

    // Call MySQL Stored Procedure RejectClaim
    await pool.query(
      'CALL RejectClaim(?, ?, ?)',
      [claimId, adminId, admin_note ? admin_note.trim() : 'Claim rejected by administrator.']
    );

    return res.json({
      success: true,
      message: 'Claim has been rejected.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  submitClaim,
  getMyClaims,
  getAllClaims,
  approveClaim,
  rejectClaim
};
