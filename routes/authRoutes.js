const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Admin login (API)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const [rows] = await db.execute(
            'SELECT * FROM admin_users WHERE email = ? AND is_active = 1',
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const admin = rows[0];
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // JWT token
        const token = jwt.sign(
            { id: admin.id, email: admin.email, role: admin.role, name: admin.name },
            process.env.JWT_SECRET || 'secret',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Session
        req.session.admin = { id: admin.id, email: admin.email, role: admin.role, name: admin.name };

        res.json({
            success: true,
            data: {
                token,
                admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Register admin (SuperAdmin only)
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, role, campus_id } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [result] = await db.execute(
            'INSERT INTO admin_users (name, email, password, role, campus_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, role || 'AdmissionOfficer', campus_id || null]
        );

        res.json({ success: true, data: { id: result.insertId } });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

module.exports = router;
