const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters in length.'
      });
    }

    // Check if user already exists
    const [existing] = await pool.query('SELECT user_id FROM Users WHERE email = ?', [trimmedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const [result] = await pool.query(
      'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, "STUDENT")',
      [trimmedName, trimmedEmail, passwordHash]
    );

    const newUser = {
      user_id: result.insertId,
      name: trimmedName,
      email: trimmedEmail,
      role: 'STUDENT'
    };

    req.session.user = newUser;

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to the Smart Lost & Found platform.',
      user: newUser
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password_hash, role, created_at FROM Users WHERE email = ?',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const sessionUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.session.user = sessionUser;

    return res.json({
      success: true,
      message: 'Login successful.',
      user: sessionUser
    });
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Could not log out.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
}

async function getCurrentUser(req, res, next) {
  try {
    if (!req.session || !req.session.user) {
      return res.json({ success: true, authenticated: false, user: null });
    }

    const userId = req.session.user.user_id;

    // Call stored functions to retrieve user stats directly from MySQL
    const [[stats]] = await pool.query(
      `SELECT
         CountUserItems(?) AS total_items,
         GetUserRecoveryCount(?) AS total_recoveries`,
      [userId, userId]
    );

    return res.json({
      success: true,
      authenticated: true,
      user: {
        ...req.session.user,
        stats: {
          total_items: stats.total_items || 0,
          total_recoveries: stats.total_recoveries || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = req.session.user.user_id;
    const { name, current_password, new_password } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name cannot be empty.' });
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ success: false, message: 'Current password is required to change password.' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
      }

      const [rows] = await pool.query('SELECT password_hash FROM Users WHERE user_id = ?', [userId]);
      const isMatch = await bcrypt.compare(current_password, rows[0].password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }

      const salt = await bcrypt.genSalt(10);
      const newHash = await bcrypt.hash(new_password, salt);
      await pool.query('UPDATE Users SET name = ?, password_hash = ? WHERE user_id = ?', [name.trim(), newHash, userId]);
    } else {
      await pool.query('UPDATE Users SET name = ? WHERE user_id = ?', [name.trim(), userId]);
    }

    req.session.user.name = name.trim();
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: req.session.user
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  updateProfile
};
