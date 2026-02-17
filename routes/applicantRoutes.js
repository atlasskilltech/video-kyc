const express = require('express');
const router = express.Router();
const ApplicantModel = require('../models/ApplicantModel');
const DocumentModel = require('../models/DocumentModel');
const ValidationModel = require('../models/ValidationModel');
const AuditModel = require('../models/AuditModel');
const ValidationEngine = require('../utils/ValidationEngine');
const upload = require('../middleware/upload');
const db = require('../config/database');

// ===================== APPLICANT CRUD =====================

// Create applicant
router.post('/create', async (req, res) => {
    try {
        const result = await ApplicantModel.create(req.body);
        await AuditModel.log(result.id, 'Application Created', req.body);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all applicants with filters
router.get('/list', async (req, res) => {
    try {
        const applicants = await ApplicantModel.getAll(req.query);
        res.json({ success: true, data: applicants });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get applicant detail
router.get('/:id', async (req, res) => {
    try {
        const applicant = await ApplicantModel.getById(req.params.id);
        if (!applicant) return res.status(404).json({ success: false, message: 'Not found' });

        const documents = await DocumentModel.getApplicantDocuments(req.params.id);
        const validations = await ValidationModel.getByApplicant(req.params.id);
        const summary = await ValidationModel.getReviewSummary(req.params.id);
        const checklist = await DocumentModel.getChecklist(applicant.program_id);
        const audit = await AuditModel.getByApplicant(req.params.id);

        res.json({
            success: true,
            data: { applicant, documents, validations, summary, checklist, audit }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== DOCUMENT UPLOAD =====================

// Upload document for applicant
router.post('/:applicantId/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        const ext = req.file.originalname.split('.').pop();
        const result = await DocumentModel.uploadDocument({
            applicant_id: req.params.applicantId,
            document_type_id: req.body.document_type_id,
            file_name: req.file.originalname,
            file_path: req.file.path,
            file_size: req.file.size,
            file_format: ext
        });

        await AuditModel.log(req.params.applicantId, 'Document Uploaded', {
            document_type_id: req.body.document_type_id,
            file_name: req.file.originalname,
            version: result.version
        });

        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get document upload history
router.get('/:applicantId/documents/:docTypeId/history', async (req, res) => {
    try {
        const history = await DocumentModel.getUploadHistory(req.params.applicantId, req.params.docTypeId);
        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== VALIDATION =====================

// Run validation for applicant
router.post('/:id/validate', async (req, res) => {
    try {
        const result = await ValidationEngine.validateApplication(req.params.id);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Submit application (triggers validation)
router.post('/:id/submit', async (req, res) => {
    try {
        const submitted = await ApplicantModel.submit(req.params.id);
        if (!submitted) {
            return res.status(400).json({ success: false, message: 'Cannot submit. Application may already be submitted.' });
        }
        // Auto-validate on submit
        const result = await ValidationEngine.validateApplication(req.params.id);
        await AuditModel.log(req.params.id, 'Application Submitted & Validated');
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== PROGRAMS & CHECKLISTS =====================

// Get all programs
router.get('/config/programs', async (req, res) => {
    try {
        const [rows] = await db.execute(`SELECT p.*, c.name as campus_name FROM programs p JOIN campuses c ON p.campus_id = c.id WHERE p.is_active = 1`);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get document types
router.get('/config/document-types', async (req, res) => {
    try {
        const types = await DocumentModel.getAllTypes();
        res.json({ success: true, data: types });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get checklist for a program
router.get('/config/checklist/:programId', async (req, res) => {
    try {
        const checklist = await DocumentModel.getChecklist(req.params.programId);
        res.json({ success: true, data: checklist });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
