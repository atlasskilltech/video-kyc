const express = require('express');
const router = express.Router();
const AtlasApiClient = require('../services/AtlasApiClient');
const DocumentVerificationService = require('../services/DocumentVerificationService');

const atlasClient = new AtlasApiClient();
const verificationService = new DocumentVerificationService();

// ===================== STUDENT LIST =====================

/**
 * GET /api/verification/students
 * Fetch the student list from Atlas API
 */
router.get('/students', async (req, res) => {
    try {
        const result = await atlasClient.getStudentList();
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching student list:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== DOCUMENT LIST =====================

/**
 * POST /api/verification/documents
 * Fetch documents for a specific student
 * Body: { applnID: "2500623" }
 */
router.post('/documents', async (req, res) => {
    try {
        const { applnID } = req.body;
        if (!applnID) {
            return res.status(400).json({ success: false, message: 'applnID is required' });
        }
        const result = await atlasClient.getDocumentList(applnID);
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching document list:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== VERIFY SINGLE DOCUMENT =====================

/**
 * POST /api/verification/verify-document
 * Verify a single document using AI
 * Body: { file_url, filename, document_label, document_type_name, document_description }
 */
router.post('/verify-document', async (req, res) => {
    try {
        const { file_url, filename, document_label, document_type_name, document_description } = req.body;

        if (!file_url || !filename) {
            return res.status(400).json({ success: false, message: 'file_url and filename are required' });
        }

        // Download the document
        const { buffer, contentType } = await atlasClient.downloadDocument(file_url);

        // Verify with AI
        const result = await verificationService.verify(buffer, {
            filename,
            contentType,
            document_label: document_label || 'Unknown Document',
            document_type_name: document_type_name || 'unknown',
            document_description: document_description || ''
        });

        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error verifying document:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== VERIFY ALL DOCUMENTS FOR A STUDENT =====================

/**
 * POST /api/verification/verify-student
 * Fetch all documents for a student, verify each with AI, and update status
 * Body: { applnID: "2500623" }
 */
router.post('/verify-student', async (req, res) => {
    try {
        const { applnID } = req.body;
        if (!applnID) {
            return res.status(400).json({ success: false, message: 'applnID is required' });
        }

        // Step 1: Fetch document list
        const docListResponse = await atlasClient.getDocumentList(applnID);

        if (docListResponse.status !== 1 || !docListResponse.data?.document_status) {
            return res.status(400).json({
                success: false,
                message: 'Failed to fetch document list',
                details: docListResponse
            });
        }

        const documents = docListResponse.data.document_status;

        // Step 2: Filter documents that have been uploaded (have a file_url)
        const uploadedDocs = documents.filter(doc => doc.file_url && doc.file_url.trim() !== '');

        if (uploadedDocs.length === 0) {
            return res.json({
                success: true,
                message: 'No uploaded documents found to verify',
                data: { applnID, results: [], statusUpdate: null }
            });
        }

        // Step 3: Verify each document with AI
        const verificationResults = [];
        const statusUpdates = [];

        for (const doc of uploadedDocs) {
            console.log(`Verifying: ${doc.document_label} (${doc.filename})`);

            try {
                // Download the document
                const { buffer, contentType } = await atlasClient.downloadDocument(doc.file_url);

                // Verify with AI
                const result = await verificationService.verify(buffer, {
                    filename: doc.filename,
                    contentType,
                    document_label: doc.document_label,
                    document_type_name: doc.document_type_name,
                    document_description: doc.document_description
                });

                const docResult = {
                    document_type_id: doc.document_type_id,
                    document_label: doc.document_label,
                    filename: doc.filename,
                    verification: result
                };

                verificationResults.push(docResult);

                // Map AI result to status update format
                statusUpdates.push({
                    document_type_id: doc.document_type_id,
                    doc_ai_status: result.status === 'approve' ? 'Verified' : 'reject',
                    doc_ai_remark: result.remark
                });

            } catch (docErr) {
                console.error(`Error verifying ${doc.document_label}:`, docErr.message);

                verificationResults.push({
                    document_type_id: doc.document_type_id,
                    document_label: doc.document_label,
                    filename: doc.filename,
                    verification: {
                        status: 'error',
                        confidence: 0,
                        remark: `Verification failed: ${docErr.message}`,
                        issues: ['Verification process error']
                    }
                });

                statusUpdates.push({
                    document_type_id: doc.document_type_id,
                    doc_ai_status: 'error',
                    doc_ai_remark: `Verification failed: ${docErr.message}`
                });
            }
        }

        // Step 4: Post status update back to Atlas API
        let statusUpdateResponse = null;
        try {
            statusUpdateResponse = await atlasClient.updateDocumentStatus(applnID, statusUpdates);
        } catch (updateErr) {
            console.error('Error updating document status:', updateErr.message);
            statusUpdateResponse = { error: updateErr.message };
        }

        // Summary
        const approved = verificationResults.filter(r => r.verification.status === 'approve').length;
        const rejected = verificationResults.filter(r => r.verification.status === 'reject').length;
        const errors = verificationResults.filter(r => r.verification.status === 'error').length;

        res.json({
            success: true,
            data: {
                applnID,
                summary: {
                    total_documents: documents.length,
                    uploaded_documents: uploadedDocs.length,
                    verified_approved: approved,
                    verified_rejected: rejected,
                    verification_errors: errors
                },
                results: verificationResults,
                statusUpdate: statusUpdateResponse
            }
        });

    } catch (err) {
        console.error('Error in student verification:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===================== BULK VERIFY ALL STUDENTS =====================

/**
 * POST /api/verification/verify-all
 * Fetch all students, verify all their documents, and update statuses
 * This is a long-running operation - use with caution
 */
router.post('/verify-all', async (req, res) => {
    try {
        // Step 1: Fetch student list
        const studentListResponse = await atlasClient.getStudentList();

        if (!studentListResponse || !studentListResponse.data) {
            return res.status(400).json({
                success: false,
                message: 'Failed to fetch student list'
            });
        }

        const students = Array.isArray(studentListResponse.data)
            ? studentListResponse.data
            : [studentListResponse.data];

        const allResults = [];
        let processedCount = 0;

        for (const student of students) {
            const applnID = student.applnID || student.id || student.application_id;
            if (!applnID) continue;

            console.log(`Processing student: ${applnID} (${processedCount + 1}/${students.length})`);

            try {
                // Fetch documents
                const docListResponse = await atlasClient.getDocumentList(applnID);

                if (docListResponse.status !== 1 || !docListResponse.data?.document_status) {
                    allResults.push({ applnID, status: 'skipped', reason: 'No documents found' });
                    continue;
                }

                const uploadedDocs = docListResponse.data.document_status
                    .filter(doc => doc.file_url && doc.file_url.trim() !== '');

                if (uploadedDocs.length === 0) {
                    allResults.push({ applnID, status: 'skipped', reason: 'No uploaded documents' });
                    continue;
                }

                // Verify each document
                const statusUpdates = [];

                for (const doc of uploadedDocs) {
                    try {
                        const { buffer, contentType } = await atlasClient.downloadDocument(doc.file_url);

                        const result = await verificationService.verify(buffer, {
                            filename: doc.filename,
                            contentType,
                            document_label: doc.document_label,
                            document_type_name: doc.document_type_name,
                            document_description: doc.document_description
                        });

                        statusUpdates.push({
                            document_type_id: doc.document_type_id,
                            doc_ai_status: result.status === 'approve' ? 'Verified' : 'reject',
                            doc_ai_remark: result.remark
                        });
                    } catch (docErr) {
                        statusUpdates.push({
                            document_type_id: doc.document_type_id,
                            doc_ai_status: 'error',
                            doc_ai_remark: `Verification failed: ${docErr.message}`
                        });
                    }
                }

                // Update status
                await atlasClient.updateDocumentStatus(applnID, statusUpdates);

                const approved = statusUpdates.filter(u => u.doc_ai_status === 'Verified').length;
                const rejected = statusUpdates.filter(u => u.doc_ai_status === 'reject').length;

                allResults.push({
                    applnID,
                    status: 'processed',
                    total: uploadedDocs.length,
                    approved,
                    rejected
                });

            } catch (studentErr) {
                allResults.push({ applnID, status: 'error', reason: studentErr.message });
            }

            processedCount++;
        }

        res.json({
            success: true,
            data: {
                total_students: students.length,
                processed: processedCount,
                results: allResults
            }
        });

    } catch (err) {
        console.error('Error in bulk verification:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
