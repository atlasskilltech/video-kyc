const db = require('../config/database');

class NotificationModel {

    static async create(data) {
        const sql = `INSERT INTO notifications 
            (applicant_id, target_type, target_user_id, alert_type, title, message)
            VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
            data.applicant_id || null, data.target_type, data.target_user_id || null,
            data.alert_type, data.title, data.message
        ]);
        return result.insertId;
    }

    static async getForAdmin(limit = 50) {
        const sql = `SELECT n.*, a.application_number, a.first_name, a.last_name
                     FROM notifications n
                     LEFT JOIN applicants a ON n.applicant_id = a.id
                     WHERE n.target_type IN ('Admin', 'ProgramHead', 'Compliance')
                     ORDER BY n.created_at DESC LIMIT ?`;
        const [rows] = await db.execute(sql, [limit]);
        return rows;
    }

    static async getForApplicant(applicantId) {
        const sql = `SELECT * FROM notifications WHERE applicant_id = ? AND target_type = 'Applicant'
                     ORDER BY created_at DESC`;
        const [rows] = await db.execute(sql, [applicantId]);
        return rows;
    }

    static async markRead(id) {
        await db.execute(`UPDATE notifications SET is_read = 1 WHERE id = ?`, [id]);
    }

    static async getUnreadCount(targetType) {
        const sql = `SELECT COUNT(*) as count FROM notifications WHERE target_type = ? AND is_read = 0`;
        const [rows] = await db.execute(sql, [targetType]);
        return rows[0].count;
    }
}

module.exports = NotificationModel;
