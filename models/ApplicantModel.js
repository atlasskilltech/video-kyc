const db = require('../config/database');

class ApplicantModel {

    // Create new applicant
    static async create(data) {
        const sql = `INSERT INTO applicants 
            (application_number, first_name, last_name, email, phone, dob, nationality, category, program_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft')`;
        const appNum = 'APP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const [result] = await db.execute(sql, [
            appNum, data.first_name, data.last_name, data.email,
            data.phone || null, data.dob || null, data.nationality || 'Indian',
            data.category || 'General', data.program_id
        ]);
        return { id: result.insertId, application_number: appNum };
    }

    // Get applicant by ID with program info
    static async getById(id) {
        const sql = `SELECT a.*, p.name as program_name, p.code as program_code, 
                     p.min_eligibility_percent, c.name as campus_name
                     FROM applicants a
                     JOIN programs p ON a.program_id = p.id
                     JOIN campuses c ON p.campus_id = c.id
                     WHERE a.id = ?`;
        const [rows] = await db.execute(sql, [id]);
        return rows[0] || null;
    }

    // List all applicants with filters
    static async getAll(filters = {}) {
        let sql = `SELECT a.*, p.name as program_name, c.name as campus_name
                   FROM applicants a
                   JOIN programs p ON a.program_id = p.id
                   JOIN campuses c ON p.campus_id = c.id WHERE 1=1`;
        const params = [];

        if (filters.status) {
            sql += ` AND a.status = ?`;
            params.push(filters.status);
        }
        if (filters.program_id) {
            sql += ` AND a.program_id = ?`;
            params.push(filters.program_id);
        }
        if (filters.campus_id) {
            sql += ` AND p.campus_id = ?`;
            params.push(filters.campus_id);
        }
        if (filters.min_risk) {
            sql += ` AND a.overall_risk_score >= ?`;
            params.push(filters.min_risk);
        }
        if (filters.max_risk) {
            sql += ` AND a.overall_risk_score <= ?`;
            params.push(filters.max_risk);
        }
        if (filters.search) {
            sql += ` AND (a.first_name LIKE ? OR a.last_name LIKE ? OR a.application_number LIKE ? OR a.email LIKE ?)`;
            const s = `%${filters.search}%`;
            params.push(s, s, s, s);
        }

        sql += ` ORDER BY a.created_at DESC`;

        if (filters.limit) {
            sql += ` LIMIT ?`;
            params.push(parseInt(filters.limit));
            if (filters.offset) {
                sql += ` OFFSET ?`;
                params.push(parseInt(filters.offset));
            }
        }

        const [rows] = await db.execute(sql, params);
        return rows;
    }

    // Update applicant status & risk score
    static async updateStatus(id, status, riskScore, recommendation) {
        const sql = `UPDATE applicants SET status = ?, overall_risk_score = ?, recommendation = ?, 
                     reviewed_at = NOW(), updated_at = NOW() WHERE id = ?`;
        await db.execute(sql, [status, riskScore, recommendation, id]);
    }

    // Submit application
    static async submit(id) {
        const sql = `UPDATE applicants SET status = 'Submitted', submitted_at = NOW() WHERE id = ? AND status = 'Draft'`;
        const [result] = await db.execute(sql, [id]);
        return result.affectedRows > 0;
    }

    // Get dashboard stats
    static async getDashboardStats() {
        const sql = `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as submitted,
            SUM(CASE WHEN status = 'Under Review' THEN 1 ELSE 0 END) as under_review,
            SUM(CASE WHEN status = 'Verified' THEN 1 ELSE 0 END) as verified,
            SUM(CASE WHEN status = 'Pending Documents' THEN 1 ELSE 0 END) as pending_docs,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
            SUM(CASE WHEN status = 'Escalated' THEN 1 ELSE 0 END) as escalated,
            SUM(CASE WHEN status = 'Conditional Approval' THEN 1 ELSE 0 END) as conditional,
            SUM(CASE WHEN overall_risk_score >= 7 THEN 1 ELSE 0 END) as high_risk,
            AVG(overall_risk_score) as avg_risk
            FROM applicants WHERE status != 'Draft'`;
        const [rows] = await db.execute(sql);
        return rows[0];
    }

    // Get stats by program
    static async getStatsByProgram() {
        const sql = `SELECT p.name as program_name, p.id as program_id, c.name as campus_name,
            COUNT(a.id) as total_applicants,
            SUM(CASE WHEN a.status = 'Verified' THEN 1 ELSE 0 END) as verified,
            SUM(CASE WHEN a.overall_risk_score >= 7 THEN 1 ELSE 0 END) as high_risk,
            AVG(a.overall_risk_score) as avg_risk
            FROM programs p
            JOIN campuses c ON p.campus_id = c.id
            LEFT JOIN applicants a ON a.program_id = p.id AND a.status != 'Draft'
            GROUP BY p.id ORDER BY p.name`;
        const [rows] = await db.execute(sql);
        return rows;
    }
}

module.exports = ApplicantModel;
