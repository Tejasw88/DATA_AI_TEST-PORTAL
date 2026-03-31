const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { protect, authorize } = require('../middleware/auth');

// Protect all admin routes
router.use(protect);
router.use(authorize('admin'));

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [activeExams] = await pool.query("SELECT COUNT(*) as count FROM sessions WHERE is_active = 1");
        const [candidatesOnline] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'candidate' AND status = 'In Progress'");
        const [submissionsToday] = await pool.query("SELECT COUNT(*) as count FROM users WHERE role = 'candidate' AND status = 'Submitted'");
        const [violationsFlagged] = await pool.query("SELECT COUNT(*) as count FROM violations");

        res.status(200).json({
            success: true,
            data: {
                active_exams: activeExams[0].count,
                candidates_online: candidatesOnline[0].count,
                submissions_today: submissionsToday[0].count,
                violations_flagged: violationsFlagged[0].count
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get questions bank
// @route   GET /api/admin/questions
router.get('/questions', async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM questions ORDER BY created_at DESC");
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Get candidates list
// @route   GET /api/admin/candidates
router.get('/candidates', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT u.*, s.name as session_name 
            FROM users u 
            LEFT JOIN sessions s ON u.session_id = s.id 
            WHERE u.role = 'candidate'
        `);
        res.status(200).json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Add new question
// @route   POST /api/admin/questions
router.post('/questions', async (req, res) => {
    const { type, title, content, domain, difficulty, marks, options, correct_answer, explanation, test_cases, starter_code } = req.body;
    try {
        await pool.query(
            "INSERT INTO questions (type, title, content, domain, difficulty, marks, options, correct_answer, explanation, test_cases, starter_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [type, title, content, domain, difficulty, marks, JSON.stringify(options), correct_answer, explanation, JSON.stringify(test_cases), JSON.stringify(starter_code)]
        );
        res.status(201).json({ success: true, message: 'Question created successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error creating question' });
    }
});

// @desc    Update question
// @route   PUT /api/admin/questions/:id
router.put('/questions/:id', async (req, res) => {
    const { type, title, content, domain, difficulty, marks, options, correct_answer, explanation, test_cases, starter_code } = req.body;
    try {
        await pool.query(
            "UPDATE questions SET type = ?, title = ?, content = ?, domain = ?, difficulty = ?, marks = ?, options = ?, correct_answer = ?, explanation = ?, test_cases = ?, starter_code = ? WHERE id = ?",
            [type, title, content, domain, difficulty, marks, JSON.stringify(options), correct_answer, explanation, JSON.stringify(test_cases), JSON.stringify(starter_code), req.params.id]
        );
        res.status(200).json({ success: true, message: 'Question updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error updating question' });
    }
});

// @desc    Delete question
// @route   DELETE /api/admin/questions/:id
router.delete('/questions/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM questions WHERE id = ?", [req.params.id]);
        res.status(200).json({ success: true, message: 'Question deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error deleting question' });
    }
});

// @desc    Add new candidate
// @route   POST /api/admin/candidates
router.post('/candidates', async (req, res) => {
    const { username, full_name, domain, difficulty, session_id } = req.body;
    const defaultPassword = 'password123';

    try {
        const password_hash = await bcrypt.hash(defaultPassword, 10);
        await pool.query(
            "INSERT INTO users (username, password_hash, full_name, domain, difficulty, session_id, role, status, violation_count) VALUES (?, ?, ?, ?, ?, ?, 'candidate', 'Not Started', 0)",
            [username, password_hash, full_name, domain, difficulty, session_id]
        );
        res.status(201).json({ success: true, message: 'Candidate registered successfully' });
    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        res.status(500).json({ success: false, message: 'Server error registering candidate' });
    }
});

module.exports = router;
