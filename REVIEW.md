# Repository Review: video-kyc (Admissions Document Review Agent)

**Review Date:** 2026-02-17

## Project Overview

A Node.js + Express + MySQL system that automatically reviews, validates, and scores applicant documents against admission compliance requirements. It features a validation engine with dynamic sensitivity scoring (1-10), document checklist management, a Tailwind CSS dashboard, role-based access control, and audit logging.

**Tech Stack:** Node.js, Express, MySQL (mysql2), EJS, Tailwind CSS, JWT, bcryptjs, Multer

---

## Architecture

The project follows an MVC-like pattern with clear separation:

```
server.js           → Express entry point
config/database.js  → MySQL connection pool
models/             → 5 data models (Applicant, Document, Validation, Notification, Audit)
routes/             → 3 route files (auth, applicant, dashboard)
middleware/         → Auth (JWT) + Upload (Multer)
utils/              → ValidationEngine (core business logic)
database/schema.sql → 10 tables + seed data
public/             → dashboard.html (single-page frontend)
```

---

## Critical Issues (Must Fix Before Deployment)

### 1. No Authentication on API Routes
**Files:** `routes/applicantRoutes.js`, `routes/dashboardRoutes.js`

Auth middleware exists in `middleware/auth.js` but is never applied to any route. All endpoints are completely open — anyone can create applicants, upload documents, view dashboard stats, and export data without logging in.

### 2. Wide-Open CORS
**File:** `server.js:11`

```js
app.use(cors());
```

Allows any origin to call the API. Must be restricted to trusted origins.

### 3. Insecure Session Cookies
**File:** `server.js:15-20`

Cookies lack `httpOnly`, `secure`, and `sameSite` flags, leaving the app vulnerable to XSS and CSRF attacks.

### 4. Raw Error Messages Returned to Clients
**Files:** Multiple route files

```js
res.status(500).json({ success: false, message: err.message });
```

Leaks database structure, file paths, and internal details.

---

## High Severity Issues

| # | Issue | Location |
|---|-------|----------|
| 5 | No input validation on any endpoint | `authRoutes.js`, `applicantRoutes.js` |
| 6 | No rate limiting (login brute-force vulnerable) | All routes |
| 7 | Hardcoded JWT fallback secret (`'secret'`) | `authRoutes.js:29` |
| 8 | Hardcoded session fallback (`'admissions-secret'`) | `server.js:16` |
| 9 | Default admin user seeded with placeholder password hash | `schema.sql:233` |
| 10 | File upload path not validated (applicantId used in fs path) | `middleware/upload.js:12` |
| 11 | No CSRF protection | Global |
| 12 | No security headers (missing helmet) | Global |

---

## Code Quality Issues

| # | Issue | Location |
|---|-------|----------|
| 13 | N+1 query problem — 6 sequential queries; should use `Promise.all()` | `applicantRoutes.js:35-52` |
| 14 | Monolithic validation method (~180 lines, 10 operations) | `ValidationEngine.js:13-190` |
| 15 | Placeholder expiry validation always returns "Pass" | `ValidationEngine.js:235-245` |
| 16 | Silent error swallowing in `evaluateCondition()` | `ValidationEngine.js:250-265` |
| 17 | No database transactions for multi-write operations | `ValidationEngine.js` |
| 18 | Magic numbers/strings throughout | Multiple files |
| 19 | App number generation uses `Date.now() + Math.random()` (not collision-safe) | `ApplicantModel.js:10` |
| 20 | No pagination on list endpoints | `applicantRoutes.js`, `dashboardRoutes.js` |

---

## Architecture / Operations Gaps

| # | Issue |
|---|-------|
| 21 | No tests (zero unit, integration, or E2E tests) |
| 22 | No database indexes on frequently queried columns |
| 23 | No API versioning |
| 24 | Console logging in production (no structured logging) |
| 25 | No request logging middleware |
| 26 | No CI/CD, Docker, or deployment config |
| 27 | No connection pool monitoring |

---

## What's Done Well

- Clean MVC-like project organization with clear file naming
- Parameterized SQL queries (SQL injection protection)
- Password hashing with bcryptjs (10 salt rounds)
- Document versioning with `is_latest` flag
- Comprehensive audit trail design with JSON detail logging
- Well-designed sensitivity scoring system (1-10) with clear escalation paths
- Database schema with proper foreign keys and enums
- Detailed README with setup instructions and API documentation

---

## Recommended Fix Priority

1. Apply auth middleware to all protected routes
2. Restrict CORS to trusted origins
3. Secure cookies (httpOnly, secure, sameSite)
4. Add input validation (express-validator or joi)
5. Stop exposing error details to clients
6. Add rate limiting on auth endpoints
7. Remove hardcoded fallback secrets — fail fast if env vars are missing
8. Add database indexes for performance
9. Parallelize DB queries with `Promise.all()`
10. Add tests — at minimum for the ValidationEngine and auth flow
