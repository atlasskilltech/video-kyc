-- =====================================================
-- Admissions Document Review Agent - Database Schema
-- =====================================================

CREATE DATABASE IF NOT EXISTS admissions_agent;
USE admissions_agent;

-- =====================================================
-- 1. Programs & Campuses
-- =====================================================
CREATE TABLE campuses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campus_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    min_eligibility_percent DECIMAL(5,2) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES campuses(id)
);

-- =====================================================
-- 2. Document Types & Checklist
-- =====================================================
CREATE TABLE document_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category ENUM('Academic','ID Proof','Migration','Financial','Other') NOT NULL,
    allowed_formats VARCHAR(255) DEFAULT 'pdf,jpg,jpeg,png',
    max_file_size_mb INT DEFAULT 5,
    has_expiry TINYINT(1) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE program_document_checklist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    document_type_id INT NOT NULL,
    requirement_type ENUM('Mandatory','Conditional','Optional') DEFAULT 'Mandatory',
    condition_rule JSON COMMENT 'e.g. {"field":"nationality","operator":"!=","value":"Indian"}',
    sensitivity_if_missing INT DEFAULT 5 COMMENT '1-10 score if missing',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id),
    FOREIGN KEY (document_type_id) REFERENCES document_types(id),
    UNIQUE KEY unique_prog_doc (program_id, document_type_id)
);

-- =====================================================
-- 3. Applicants
-- =====================================================
CREATE TABLE applicants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_number VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    dob DATE,
    nationality VARCHAR(100) DEFAULT 'Indian',
    category VARCHAR(50) COMMENT 'General, OBC, SC, ST, etc.',
    program_id INT NOT NULL,
    status ENUM('Draft','Submitted','Under Review','Verified','Conditional Approval','Pending Documents','Rejected','Escalated') DEFAULT 'Draft',
    overall_risk_score DECIMAL(4,2) DEFAULT 0,
    recommendation TEXT,
    submitted_at TIMESTAMP NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (program_id) REFERENCES programs(id)
);

-- =====================================================
-- 4. Uploaded Documents
-- =====================================================
CREATE TABLE applicant_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    document_type_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT COMMENT 'in bytes',
    file_format VARCHAR(10),
    upload_version INT DEFAULT 1,
    is_latest TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id),
    FOREIGN KEY (document_type_id) REFERENCES document_types(id)
);

-- =====================================================
-- 5. Validation Results
-- =====================================================
CREATE TABLE document_validations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_document_id INT NOT NULL,
    applicant_id INT NOT NULL,
    validation_type ENUM('Format','Expiry','DataConsistency','Completeness','AI') NOT NULL,
    status ENUM('Pass','Fail','Warning') NOT NULL,
    issue_description TEXT,
    sensitivity_score INT DEFAULT 0 COMMENT '1-10',
    sensitivity_level ENUM('Minor','Low','Medium','High','Critical') GENERATED ALWAYS AS (
        CASE
            WHEN sensitivity_score BETWEEN 1 AND 2 THEN 'Minor'
            WHEN sensitivity_score BETWEEN 3 AND 4 THEN 'Low'
            WHEN sensitivity_score BETWEEN 5 AND 6 THEN 'Medium'
            WHEN sensitivity_score BETWEEN 7 AND 8 THEN 'High'
            WHEN sensitivity_score BETWEEN 9 AND 10 THEN 'Critical'
            ELSE 'Minor'
        END
    ) STORED,
    action_required VARCHAR(255),
    validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_document_id) REFERENCES applicant_documents(id),
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

-- =====================================================
-- 6. Review Summary (per application)
-- =====================================================
CREATE TABLE review_summaries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    total_documents_required INT DEFAULT 0,
    total_documents_uploaded INT DEFAULT 0,
    total_documents_verified INT DEFAULT 0,
    total_documents_flagged INT DEFAULT 0,
    overall_risk_score DECIMAL(4,2) DEFAULT 0,
    status ENUM('Under Review','Verified','Conditional Approval','Pending Documents','Rejected','Escalated') DEFAULT 'Under Review',
    recommendation TEXT,
    reviewed_by INT NULL COMMENT 'Admin user id',
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

-- =====================================================
-- 7. Alerts & Notifications
-- =====================================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NULL,
    target_type ENUM('Applicant','Admin','ProgramHead') NOT NULL,
    target_user_id INT NULL,
    alert_type ENUM('MissingDocument','InvalidDocument','ReUploadRequest','DeadlineReminder','HighRiskEscalation','FraudAlert','EligibilityRejection') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

-- =====================================================
-- 8. Audit Trail
-- =====================================================
CREATE TABLE audit_trail (
    id INT AUTO_INCREMENT PRIMARY KEY,
    applicant_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    details JSON,
    performed_by VARCHAR(100) DEFAULT 'System',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (applicant_id) REFERENCES applicants(id)
);

-- =====================================================
-- 9. Admin Users
-- =====================================================
CREATE TABLE admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('SuperAdmin','AdmissionOfficer','ProgramHead','Compliance') DEFAULT 'AdmissionOfficer',
    campus_id INT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campus_id) REFERENCES campuses(id)
);

-- =====================================================
-- 10. Seed Data
-- =====================================================
INSERT INTO campuses (name, code) VALUES
('Main Campus', 'MAIN'),
('City Campus', 'CITY');

INSERT INTO programs (campus_id, name, code, min_eligibility_percent) VALUES
(1, 'B.Tech Computer Science', 'BTECH-CS', 60.00),
(1, 'B.Tech Electronics', 'BTECH-EC', 55.00),
(2, 'BBA', 'BBA', 50.00),
(2, 'MBA', 'MBA', 55.00);

INSERT INTO document_types (name, category, allowed_formats, max_file_size_mb, has_expiry) VALUES
('10th Marksheet', 'Academic', 'pdf,jpg,jpeg,png', 5, 0),
('12th Marksheet', 'Academic', 'pdf,jpg,jpeg,png', 5, 0),
('Graduation Marksheet', 'Academic', 'pdf,jpg,jpeg,png', 5, 0),
('Aadhaar Card', 'ID Proof', 'pdf,jpg,jpeg,png', 5, 0),
('Passport', 'ID Proof', 'pdf,jpg,jpeg,png', 5, 1),
('Transfer Certificate', 'Migration', 'pdf', 5, 0),
('Income Certificate', 'Financial', 'pdf', 5, 1),
('Caste Certificate', 'Other', 'pdf,jpg,jpeg,png', 5, 1),
('Domicile Certificate', 'Other', 'pdf,jpg,jpeg,png', 5, 1),
('Photograph', 'Other', 'jpg,jpeg,png', 2, 0);

-- B.Tech CS checklist
INSERT INTO program_document_checklist (program_id, document_type_id, requirement_type, condition_rule, sensitivity_if_missing) VALUES
(1, 1, 'Mandatory', NULL, 8),
(1, 2, 'Mandatory', NULL, 8),
(1, 4, 'Mandatory', NULL, 7),
(1, 6, 'Conditional', '{"field":"previous_institution","operator":"!=","value":"same"}', 5),
(1, 7, 'Conditional', '{"field":"category","operator":"!=","value":"General"}', 6),
(1, 10, 'Mandatory', NULL, 4);

-- MBA checklist
INSERT INTO program_document_checklist (program_id, document_type_id, requirement_type, condition_rule, sensitivity_if_missing) VALUES
(4, 1, 'Mandatory', NULL, 8),
(4, 2, 'Mandatory', NULL, 8),
(4, 3, 'Mandatory', NULL, 9),
(4, 4, 'Mandatory', NULL, 7),
(4, 7, 'Conditional', '{"field":"category","operator":"!=","value":"General"}', 6),
(4, 10, 'Mandatory', NULL, 4);

-- Default admin
INSERT INTO admin_users (name, email, password, role) VALUES
('Super Admin', 'admin@admissions.com', '$2b$10$defaulthashedpassword', 'SuperAdmin');
