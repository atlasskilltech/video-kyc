const db = require('../config/database');

class DocumentModel {

    // Get document checklist for a program
    static async getChecklist(programId) {
        const sql = `SELECT pdc.*, dt.name as document_name, dt.category, 
                     dt.allowed_formats, dt.max_file_size_mb, dt.has_expiry
                     FROM program_document_checklist pdc
                     JOIN document_types dt ON pdc.document_type_id = dt.id
                     WHERE pdc.program_id = ?
                     ORDER BY dt.category, pdc.requirement_type`;
        const [rows] = await db.execute(sql, [programId]);
        return rows;
    }

    // Get all document types
    static async getAllTypes() {
        const sql = `SELECT * FROM document_types ORDER BY category, name`;
        const [rows] = await db.execute(sql);
        return rows;
    }

    // Upload document record
    static async uploadDocument(data) {
        // Mark old versions as not latest
        await db.execute(
            `UPDATE applicant_documents SET is_latest = 0 
             WHERE applicant_id = ? AND document_type_id = ?`,
            [data.applicant_id, data.document_type_id]
        );

        // Get next version
        const [verRows] = await db.execute(
            `SELECT COALESCE(MAX(upload_version), 0) + 1 as next_ver 
             FROM applicant_documents WHERE applicant_id = ? AND document_type_id = ?`,
            [data.applicant_id, data.document_type_id]
        );
        const nextVersion = verRows[0].next_ver;

        const sql = `INSERT INTO applicant_documents 
            (applicant_id, document_type_id, file_name, file_path, file_size, file_format, upload_version, is_latest)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`;
        const [result] = await db.execute(sql, [
            data.applicant_id, data.document_type_id, data.file_name,
            data.file_path, data.file_size, data.file_format, nextVersion
        ]);
        return { id: result.insertId, version: nextVersion };
    }

    // Get applicant's documents
    static async getApplicantDocuments(applicantId) {
        const sql = `SELECT ad.*, dt.name as document_name, dt.category,
                     dt.allowed_formats, dt.max_file_size_mb, dt.has_expiry
                     FROM applicant_documents ad
                     JOIN document_types dt ON ad.document_type_id = dt.id
                     WHERE ad.applicant_id = ? AND ad.is_latest = 1
                     ORDER BY dt.category, dt.name`;
        const [rows] = await db.execute(sql, [applicantId]);
        return rows;
    }

    // Get upload history for a document
    static async getUploadHistory(applicantId, documentTypeId) {
        const sql = `SELECT ad.*, dt.name as document_name
                     FROM applicant_documents ad
                     JOIN document_types dt ON ad.document_type_id = dt.id
                     WHERE ad.applicant_id = ? AND ad.document_type_id = ?
                     ORDER BY ad.upload_version DESC`;
        const [rows] = await db.execute(sql, [applicantId, documentTypeId]);
        return rows;
    }

    // Get document by ID
    static async getDocumentById(docId) {
        const sql = `SELECT ad.*, dt.name as document_name, dt.category, 
                     dt.allowed_formats, dt.max_file_size_mb, dt.has_expiry
                     FROM applicant_documents ad
                     JOIN document_types dt ON ad.document_type_id = dt.id
                     WHERE ad.id = ?`;
        const [rows] = await db.execute(sql, [docId]);
        return rows[0] || null;
    }
}

module.exports = DocumentModel;
