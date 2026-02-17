const db = require('../config/database');

class AuditModel {

    static async log(applicantId, action, details = null, performedBy = 'System') {
        const sql = `INSERT INTO audit_trail (applicant_id, action, details, performed_by) VALUES (?, ?, ?, ?)`;
        await db.execute(sql, [applicantId, action, details ? JSON.stringify(details) : null, performedBy]);
    }

    static async getByApplicant(applicantId) {
        const sql = `SELECT * FROM audit_trail WHERE applicant_id = ? ORDER BY created_at DESC`;
        const [rows] = await db.execute(sql, [applicantId]);
        return rows;
    }
}

module.exports = AuditModel;
