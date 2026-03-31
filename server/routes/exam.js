const express = require('express');
const router = express.Router();
const pool = require('../db');
const axios = require('axios');
const { protect } = require('../middleware/auth');

// @desc    Start exam / Get questions
// @route   GET /api/exam/start
router.get('/start', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const [userRows] = await pool.query('SELECT domain, difficulty, session_id, status FROM users WHERE id = ?', [userId]);
        const user = userRows[0];

        if (user.status === 'Submitted' || user.status === 'Violated') {
            return res.status(403).json({ success: false, message: 'You have already submitted or were flagged.' });
        }

        // Update status to 'In Progress'
        await pool.query('UPDATE users SET status = "In Progress" WHERE id = ?', [userId]);

        // Get questions matching domain and difficulty
        const [questions] = await pool.query(`
            SELECT id, type, title, content, options, starter_code, marks 
            FROM questions 
            WHERE domain = ? AND difficulty = ?
            ORDER BY type, id
        `, [user.domain, user.difficulty]);

        // Get session info
        const [session] = await pool.query('SELECT * FROM sessions WHERE id = ?', [user.session_id]);

        res.status(200).json({
            success: true,
            questions,
            duration_minutes: session[0] ? session[0].duration_minutes : 60,
            candidate: {
                fullName: req.user.full_name,
                domain: user.domain,
                difficulty: user.difficulty
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Save an answer
// @route   POST /api/exam/answer
router.post('/answer', protect, async (req, res) => {
    const { question_id, answer_text, is_flagged } = req.body;
    try {
        await pool.query(`
            INSERT INTO answers (user_id, question_id, answer_text, is_flagged)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), is_flagged = VALUES(is_flagged)
        `, [req.user.id, question_id, answer_text, is_flagged || 0]);
        
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Execute code via Piston API
// @route   POST /api/exam/execute
router.post('/execute', protect, async (req, res) => {
    const { language, code, question_id } = req.body;
    try {
        const [qRows] = await pool.query('SELECT test_cases FROM questions WHERE id = ?', [question_id]);
        const testCases = JSON.parse(qRows[0].test_cases || '[]');
        const mainTestCase = testCases[0] || { input: '', output: '' };

        const response = await axios.post('https://piston.emkc.org/api/v2/execute', {
            language: language === 'javascript' ? 'js' : language,
            version: '*',
            files: [{ content: code }],
            stdin: mainTestCase.input
        });

        res.status(200).json({
            success: true,
            output: response.data.run.output,
            stdout: response.data.run.stdout,
            stderr: response.data.run.stderr,
            passed: response.data.run.stdout.trim() === mainTestCase.output.trim()
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Execution error' });
    }
});

// @desc    Log security violation
// @route   POST /api/exam/log-event
router.post('/log-event', protect, async (req, res) => {
    const { event_type, metadata } = req.body;
    try {
        await pool.query('INSERT INTO violations (user_id, type, metadata) VALUES (?, ?, ?)', [
            req.user.id,
            event_type,
            JSON.stringify(metadata || {})
        ]);
        
        // Update violation count in users table
        await pool.query('UPDATE users SET violation_count = violation_count + 1 WHERE id = ?', [req.user.id]);
        
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// @desc    Final submit
// @route   POST /api/exam/submit
router.post('/submit', protect, async (req, res) => {
    try {
        await pool.query('UPDATE users SET status = "Submitted" WHERE id = ?', [req.user.id]);
        res.status(200).json({ success: true, message: 'Exam submitted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
