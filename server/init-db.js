const pool = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function init() {
    try {
        console.log('--- Initializing DATA.AI Assessment DB ---');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                start_time DATETIME,
                end_time DATETIME,
                duration_minutes INT,
                pass_threshold INT DEFAULT 60,
                is_active TINYINT(1) DEFAULT 0,
                results_released TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role ENUM('admin', 'candidate') DEFAULT 'candidate',
                full_name VARCHAR(255),
                domain VARCHAR(255),
                difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Easy',
                session_id INT,
                status ENUM('Not Started', 'In Progress', 'Submitted', 'Violated') DEFAULT 'Not Started',
                violation_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type ENUM('MCQ', 'Coding', 'Aptitude') NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT,
                options JSON,
                correct_answer TEXT,
                explanation TEXT,
                difficulty ENUM('Easy', 'Medium', 'Hard') DEFAULT 'Easy',
                domain VARCHAR(255),
                marks INT DEFAULT 1,
                test_cases JSON,
                starter_code JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS answers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                question_id INT,
                answer_text TEXT,
                is_flagged TINYINT(1) DEFAULT 0,
                is_correct TINYINT(1),
                marks_awarded INT DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (question_id) REFERENCES questions(id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS violations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                type VARCHAR(255),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSON,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        // Seed Admin User
        const adminUsername = process.env.ADMIN_USERNAME || 'TEJASW';
        const adminPassword = process.env.ADMIN_PASSWORD || 'Pr@dnya143';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        await pool.query(`
            INSERT INTO users (username, password_hash, role, full_name)
            SELECT ?, ?, 'admin', 'Super Admin'
            WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = ?)
        `, [adminUsername, hashedPassword, adminUsername]);

        console.log('--- DB Initialization Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('--- DB Initialization Error ---', error);
        process.exit(1);
    }
}

init();
