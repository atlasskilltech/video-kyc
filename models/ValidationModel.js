const db = require('../config/database');

class ValidationModel {

    // Save validation result
    static async saveResult(data) {
        const sql = `INSERT INTO document_validations 
            (applicant_document_id, applicant_id, validation_type, status, issue_description, sensitivity_score, action_required)
            VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [result] = await db.execute(sql, [
            data.applicant_document_id, data.applicant_id, data.validation_type,
            data.status, data.issue_description || null,
            data.sensitivity_score || 0, data.action_required || null
        ]);
        return result.insertId;
    }

    // Get validations for a document
    static async getByDocument(docId) {
        const sql = `SELECT * FROM document_validations 
                     WHERE applicant_document_id = ? ORDER BY validated_at DESC`;
        const [rows] = await db.execute(sql, [docId]);
        return rows;
    }

    // Get all validations for an applicant
    static async getByApplicant(applicantId) {
        const sql = `SELECT dv.*, ad.file_name, dt.name as document_name, dt.category
                     FROM document_validations dv
                     JOIN applicant_documents ad ON dv.applicant_document_id = ad.id
                     JOIN document_types dt ON ad.document_type_id = dt.id
                     WHERE dv.applicant_id = ? AND ad.is_latest = 1
                     ORDER BY dv.sensitivity_score DESC`;
        const [rows] = await db.execute(sql, [applicantId]);
        return rows;
    }

    // Clear old validations for re-validation
    static async clearForDocument(docId) {
        await db.execute(`DELETE FROM document_validations WHERE applicant_document_id = ?`, [docId]);
    }

    // Save review summary
    static async saveReviewSummary(data) {
        // Upsert
        const [existing] = await db.execute(
            `SELECT id FROM review_summaries WHERE applicant_id = ?`, [data.applicant_id]
        );

        if (existing.length > 0) {
            await db.execute(`UPDATE review_summaries SET 
                total_documents_required = ?, total_documents_uploaded = ?,
                total_documents_verified = ?, total_documents_flagged = ?,
                overall_risk_score = ?, status = ?, recommendation = ?, updated_at = NOW()
                WHERE applicant_id = ?`, [
                data.total_required, data.total_uploaded, data.total_verified,
                data.total_flagged, data.risk_score, data.status, data.recommendation,
                data.applicant_id
            ]);
            return existing[0].id;
        } else {
            const [result] = await db.execute(`INSERT INTO review_summaries 
                (applicant_id, total_documents_required, total_documents_uploaded,
                 total_documents_verified, total_documents_flagged, overall_risk_score, status, recommendation)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                data.applicant_id, data.total_required, data.total_uploaded,
                data.total_verified, data.total_flagged, data.risk_score, data.status, data.recommendation
            ]);
            return result.insertId;
        }
    }

    // Get review summary
    static async getReviewSummary(applicantId) {
        const sql = `SELECT * FROM review_summaries WHERE applicant_id = ?`;
        const [rows] = await db.execute(sql, [applicantId]);
        return rows[0] || null;
    }
}

module.exports = ValidationModel;
