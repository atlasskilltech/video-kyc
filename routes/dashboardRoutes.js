const express = require('express');
const router = express.Router();
const ApplicantModel = require('../models/ApplicantModel');
const NotificationModel = require('../models/NotificationModel');
const db = require('../config/database');

// Dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await ApplicantModel.getDashboardStats();
        const byProgram = await ApplicantModel.getStatsByProgram();
        const unreadAlerts = await NotificationModel.getUnreadCount('Admin');
        res.json({ success: true, data: { stats, byProgram, unreadAlerts } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get notifications
router.get('/notifications', async (req, res) => {
    try {
        const notifications = await NotificationModel.getForAdmin(parseInt(req.query.limit) || 50);
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Mark notification read
router.put('/notifications/:id/read', async (req, res) => {
    try {
        await NotificationModel.markRead(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// High sensitivity cases
router.get('/high-risk', async (req, res) => {
    try {
        const applicants = await ApplicantModel.getAll({ min_risk: 7, limit: 50 });
        res.json({ success: true, data: applicants });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Export review summary
router.get('/export/:applicantId', async (req, res) => {
    try {
        const applicant = await ApplicantModel.getById(req.params.applicantId);
        const DocumentModel = require('../models/DocumentModel');
        const ValidationModel = require('../models/ValidationModel');

        const documents = await DocumentModel.getApplicantDocuments(req.params.applicantId);
        const validations = await ValidationModel.getByApplicant(req.params.applicantId);
        const summary = await ValidationModel.getReviewSummary(req.params.applicantId);

        res.json({
            success: true,
            data: {
                applicant,
                documents,
                validations,
                summary,
                exported_at: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
