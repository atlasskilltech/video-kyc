const axios = require('axios');

class AtlasApiClient {

    constructor() {
        this.baseURL = process.env.ATLAS_API_BASE_URL || 'https://www.atlasskilltech.app/admissions/api';
        this.token = process.env.ATLAS_API_TOKEN;

        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Fetch the list of students
     */
    async getStudentList() {
        const response = await this.client.get('/getStudentList');
        return response.data;
    }

    /**
     * Fetch the document list for a specific student
     * @param {string} applnID - The application ID
     */
    async getDocumentList(applnID) {
        const response = await this.client.post('/documentList', { applnID });
        return response.data;
    }

    /**
     * Update document verification status for a student
     * @param {string} applnID - The application ID
     * @param {Array} documentStatus - Array of { document_type_id, doc_ai_status, doc_ai_remark }
     */
    async updateDocumentStatus(applnID, documentStatus) {
        const response = await this.client.post('/documentStatusUpdate', {
            applnID,
            document_status: documentStatus
        });
        return response.data;
    }

    /**
     * Download a document file from its URL
     * @param {string} fileUrl - The S3 URL of the document
     * @returns {{ buffer: Buffer, contentType: string }}
     */
    async downloadDocument(fileUrl) {
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            timeout: 60000
        });
        return {
            buffer: Buffer.from(response.data),
            contentType: response.headers['content-type'] || 'application/octet-stream'
        };
    }
}

module.exports = AtlasApiClient;
