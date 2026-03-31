const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { protect } = require('../middleware/auth');

// @desc    Authenticate user (Admin or Candidate)
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide username and password' });
    }

    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if candidate has an active session (simplified for now)
        if (user.role === 'candidate' && user.status === 'Violated') {
            return res.status(403).json({ success: false, message: 'Access denied due to violation flag.' });
        }

        // Create token
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                fullName: user.full_name,
                domain: user.domain,
                difficulty: user.difficulty
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, full_name, domain, difficulty, session_id FROM users WHERE id = ?', [req.user.id]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        res.status(200).json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Public
router.post('/logout', (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    res.status(200).json({ success: true, message: 'User logged out' });
});

module.exports = router;
