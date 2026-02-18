const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');

class DocumentVerificationService {

    constructor() {
        this.provider = process.env.AI_PROVIDER || 'claude'; // 'claude' or 'openai'

        if (this.provider === 'claude') {
            this.claude = new Anthropic.default({
                apiKey: process.env.ANTHROPIC_API_KEY
            });
        } else {
            this.openai = new OpenAI.default({
                apiKey: process.env.OPENAI_API_KEY
            });
        }
    }

    /**
     * Build the verification system prompt
     */
    getSystemPrompt() {
        return `You are a document verification AI assistant for an educational admissions system.

Your job is to verify uploaded documents against their expected type and description.

For each document, you must analyze:
1. DOCUMENT TYPE MATCH: Does the uploaded document match the expected document type (e.g., marksheet, certificate, ID proof, photograph)?
2. DESCRIPTION COMPLIANCE: Does the document satisfy the requirements described in the document_description?
3. LEGIBILITY: Is the document clear, readable, and not blurry or cut off?
4. AUTHENTICITY INDICATORS: Does the document appear to be a genuine document (has proper formatting, stamps, signatures where expected)?
5. COMPLETENESS: Is the full document visible or is it partially cropped/missing sections?

You must respond ONLY with a valid JSON object (no markdown, no code fences) with these fields:
{
  "status": "approve" or "reject",
  "confidence": 0.0 to 1.0,
  "remark": "Brief explanation of the verification result",
  "issues": ["list of specific issues found, if any"]
}

Status guidelines:
- "approve": Document matches the expected type, satisfies the description, is legible, and appears authentic.
- "reject": Document does not match the expected type, fails to meet the description requirements, is illegible, appears tampered with, or has significant issues.

Be strict but fair. Only approve if you are reasonably confident the document is correct.
For photographs: Check if it appears to be a passport-size photo with appropriate background.
For marksheets/certificates: Check if they appear to be official academic documents.
For ID proofs (Aadhar, PAN): Check if they appear to be valid government-issued identity documents.
For affidavits/undertakings: Check if they appear to be on proper stamp paper with signatures.`;
    }

    /**
     * Build the user prompt for a specific document
     */
    buildDocumentPrompt(document) {
        let prompt = `Please verify the following uploaded document:\n\n`;
        prompt += `Expected Document Type: ${document.document_label}\n`;
        prompt += `Document Category: ${document.document_type_name}\n`;

        if (document.document_description && document.document_description.trim()) {
            prompt += `Requirements/Description: ${document.document_description}\n`;
        }

        prompt += `\nAnalyze the attached document image/file and determine if it matches the expected type and satisfies the requirements described above. Respond with a JSON object.`;

        return prompt;
    }

    /**
     * Get the media type for Claude API from file extension or content type
     */
    getMediaType(filename, contentType) {
        const ext = filename.split('.').pop().toLowerCase();

        if (contentType && contentType !== 'application/octet-stream') {
            // Map common content types
            if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'image/jpeg';
            if (contentType.includes('png')) return 'image/png';
            if (contentType.includes('gif')) return 'image/gif';
            if (contentType.includes('webp')) return 'image/webp';
            if (contentType.includes('pdf')) return 'application/pdf';
        }

        const extMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'pdf': 'application/pdf'
        };

        return extMap[ext] || 'image/jpeg';
    }

    /**
     * Verify a single document using Claude's vision API
     * @param {Buffer} fileBuffer - The document file as a buffer
     * @param {Object} document - Document metadata from the API
     * @returns {Object} Verification result
     */
    async verifyWithClaude(fileBuffer, document) {
        const mediaType = this.getMediaType(document.filename, document.contentType);
        const base64Data = fileBuffer.toString('base64');
        const userPrompt = this.buildDocumentPrompt(document);

        const contentBlocks = [];

        if (mediaType === 'application/pdf') {
            contentBlocks.push({
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64Data
                }
            });
        } else {
            contentBlocks.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Data
                }
            });
        }

        contentBlocks.push({
            type: 'text',
            text: userPrompt
        });

        const response = await this.claude.messages.create({
            model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: this.getSystemPrompt(),
            messages: [
                {
                    role: 'user',
                    content: contentBlocks
                }
            ]
        });

        const text = response.content[0].text;
        return this.parseAIResponse(text);
    }

    /**
     * Verify a single document using OpenAI's vision API
     * @param {Buffer} fileBuffer - The document file as a buffer
     * @param {Object} document - Document metadata from the API
     * @returns {Object} Verification result
     */
    async verifyWithOpenAI(fileBuffer, document) {
        const mediaType = this.getMediaType(document.filename, document.contentType);
        const base64Data = fileBuffer.toString('base64');
        const userPrompt = this.buildDocumentPrompt(document);

        const contentParts = [
            {
                type: 'image_url',
                image_url: {
                    url: `data:${mediaType};base64,${base64Data}`,
                    detail: 'high'
                }
            },
            {
                type: 'text',
                text: userPrompt
            }
        ];

        const response = await this.openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            max_tokens: 1024,
            messages: [
                {
                    role: 'system',
                    content: this.getSystemPrompt()
                },
                {
                    role: 'user',
                    content: contentParts
                }
            ]
        });

        const text = response.choices[0].message.content;
        return this.parseAIResponse(text);
    }

    /**
     * Parse the AI response text into a structured object
     */
    parseAIResponse(text) {
        try {
            // Strip markdown code fences if present
            let cleaned = text.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }
            const result = JSON.parse(cleaned);
            return {
                status: result.status || 'reject',
                confidence: result.confidence || 0,
                remark: result.remark || 'Unable to determine',
                issues: result.issues || []
            };
        } catch (e) {
            // If parsing fails, treat as a rejection with the raw text as remark
            return {
                status: 'reject',
                confidence: 0,
                remark: `AI response parsing failed: ${text.substring(0, 200)}`,
                issues: ['Could not parse AI verification response']
            };
        }
    }

    /**
     * Main verification method - routes to the configured AI provider
     * @param {Buffer} fileBuffer - The document file as a buffer
     * @param {Object} document - Document metadata
     * @returns {Object} Verification result { status, confidence, remark, issues }
     */
    async verify(fileBuffer, document) {
        if (this.provider === 'claude') {
            return this.verifyWithClaude(fileBuffer, document);
        } else {
            return this.verifyWithOpenAI(fileBuffer, document);
        }
    }
}

module.exports = DocumentVerificationService;
