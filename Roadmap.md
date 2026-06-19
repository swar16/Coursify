# LMS Backend Roadmap (Udemy-Style) - Production Grade Learning Project

## Project Philosophy

This project has two simultaneous goals:

1. Build a production-grade LMS backend similar to Udemy.
2. Learn backend engineering, system design, Prisma, Express, authorization, and API design.

Therefore:

- AI agents should NOT blindly generate endpoints.
- AI agents should first explain the reasoning, tradeoffs, business rules, and authorization model.
- Then provide implementation guidance.
- Then provide production-ready code.
- The human developer should understand the architecture before copying code.

---

# Current Feature Status

## Implemented

### Authentication

- Signup
- Login
- JWT Authentication
- Role Based Access
    - Student
    - Instructor
- Optional Authentication Middleware

### Courses

- Create Course
- Update Course
- Delete Course
- Get Course
- List Courses
- Pagination
- Search
- Sorting
- Price Filtering

### Course Lifecycle

- Draft
- Published
- Archived

Rules:

- Draft -> Published
- Published -> Archived
- Archived -> Published

Publishing validation:

- Must have at least one section
- Must have at least one lecture
- Every section must contain at least one lecture

### Sections

- Create Section

### Lectures

- Create Lecture
- Progress Tracking

### Purchases

- Mock Purchases

### Reviews

- Create Review
- Update Review
- Review Aggregation
- Average Rating
- Review Count
- Review Listing

### Progress

- Lecture Completion
- Course Progress

---

# IMPORTANT REVIEW PHASE

Before implementing any new feature:

AI Agent MUST review all existing endpoints.

Goals:

- Remove duplicated logic
- Standardize response shapes
- Verify authorization
- Verify pagination
- Verify status checks
- Verify validation
- Verify error handling

Many existing endpoints were written while learning.

They work.

They may not be production-grade.

Perform endpoint audit before major new features.

---

# Global API Standards

## Error Shape

Use:

```json
{
  "error": "Message"
}
```

Never mix:

```json
{
  "message": "error"
}
```

for errors.

---

## Pagination Shape

All paginated endpoints must return:

```json
{
  "page": 1,
  "limit": 10,
  "totalItems": 100,
  "totalPages": 10,
  "items": []
}
```

Adapt naming if necessary:

```json
{
  "reviews": []
}
```

or

```json
{
  "courses": []
}
```

but metadata must remain consistent.

---

## Authorization Pattern

Validate in this order:

1. Route Params
2. Request Body
3. Entity Exists
4. Authorization
5. Business Rules
6. Database Write

---

# Phase 1 - Complete Reviews System

## Feature 1

DELETE /courses/:id/review

### Rules

- Student only
- Must have purchased course
- Must own review

### Flow

Delete Review

↓

Recalculate aggregate

↓

Update Course.averageRating

↓

Update Course.reviewCount

↓

Return success

### Commit

```bash
git commit -m "add review deletion support"
```

---

# Phase 2 - Categories & Discovery

## New Models

Category

```prisma
id
name
slug
```

Course

```prisma
categoryId
```

---

## Endpoints

GET /categories

POST /categories

Admin only

GET /courses?category=tech

GET /courses?category=finance

---

## Optional

Difficulty

```text
BEGINNER
INTERMEDIATE
ADVANCED
```

---

### Commit

```bash
git commit -m "add course categorization system"
```

---

# Phase 3 - Instructor Analytics

High Priority

---

## Endpoint

GET /instructor/courses/:id/analytics

Instructor must own course.

---

## Analytics Returned

### Revenue

Mock Revenue

```text
price * purchaseCount
```

---

### Purchases

```json
{
  "purchaseCount": 123
}
```

---

### Ratings

```json
{
  "averageRating": 4.8,
  "reviewCount": 54
}
```

---

### Completion

```json
{
  "started": 100,
  "completed": 40,
  "completionRate": 40
}
```

---

### Review Analytics

Recent Reviews

Rating Distribution

```json
{
  "5": 100,
  "4": 20,
  "3": 5
}
```

---

## Privacy Requirements

Instructor CANNOT see:

- Student emails
- Student passwords
- Private user information

Instructor MAY see:

- Aggregate statistics
- Public review names

---

### Commit

```bash
git commit -m "implement instructor analytics dashboard"
```

---

# Phase 4 - Certificates

High Priority

---

## Business Rule

Certificate automatically issued when:

```text
Course Progress = 100%
```

---

## Model

Certificate

```prisma
id
userId
courseId
issuedAt
certificateNumber
```

---

## Endpoint

GET /courses/:id/certificate

Rules:

- Purchased
- 100% completed

---

## Generation

Initially:

Return JSON

Later:

Generate PDF

Developer should implement PDF generation manually for learning.

---

### Commit

```bash
git commit -m "add course completion certificates"
```

---

# Phase 5 - Wishlist

Medium Priority

---

## Model

Wishlist

```prisma
userId
courseId
```

Unique Pair

---

## Endpoints

POST /courses/:id/wishlist

DELETE /courses/:id/wishlist

GET /wishlist

---

### Commit

```bash
git commit -m "implement wishlist functionality"
```

---

# Phase 6 - Discussion System

High Priority

This replaces generic course comments.

Discussions should exist per lecture.

---

## Model

Discussion

```prisma
id
lectureId
userId
message
createdAt
updatedAt
```

---

## Future

Nested Replies

Not required initially.

---

## Endpoints

POST /lectures/:id/discussions

GET /lectures/:id/discussions

DELETE /discussions/:id

PATCH /discussions/:id

---

## Rules

Only purchased users may participate.

Everyone with lecture access may read.

---

### Commit

```bash
git commit -m "implement lecture discussion system"
```

---

# Phase 7 - Student Dashboard

GET /me/dashboard

---

## Returns

Purchased Courses

Progress

Certificates

Wishlist

Recent Activity

---

### Commit

```bash
git commit -m "add student dashboard"
```

---

# Phase 8 - Payment Integration (Developer Learning Phase)

Do NOT implement immediately.

Developer wants to learn and implement personally.

---

## Research Topics

- Razorpay
- Stripe
- Webhooks
- Payment Verification
- Signature Validation
- Idempotency Keys

---

## Future Models

Order

Payment

Transaction

---

## Flow

Create Order

↓

Payment Gateway

↓

Webhook

↓

Verify Signature

↓

Create Purchase

---

### Commit

```bash
git commit -m "integrate payment gateway and purchase verification"
```

---

# Phase 9 - Media Infrastructure

Do NOT implement immediately.

Developer wants to learn manually.

---

## Research Topics

- S3
- Cloudflare R2
- Signed URLs
- Multipart Uploads
- Video Streaming
- CDN

---

## Future Endpoints

POST /upload

POST /lectures/:id/video

GET /media/:id

---

# Phase 10 - Admin System

Late Stage

---

## Roles

Student

Instructor

Admin

---

## Admin Features

Manage Users

Manage Courses

Manage Reviews

Ban Users

Remove Courses

Platform Analytics

---

## Endpoints

GET /admin/users

GET /admin/courses

PATCH /admin/users/:id

DELETE /admin/reviews/:id

---

### Commit

```bash
git commit -m "implement admin management system"
```

---

# Final Production Review

Before declaring project complete:

AI Agent MUST perform:

## Security Audit

- Authorization
- Authentication
- Input Validation
- SQL Injection
- Rate Limiting

## API Audit

- Consistent Responses
- Consistent Pagination
- Consistent Errors

## Database Audit

- Missing Indexes
- N+1 Queries
- Transaction Usage

## LMS Audit

Verify:

- Course Lifecycle
- Purchases
- Reviews
- Progress
- Certificates
- Analytics
- Discussions
- Payments

All business rules must match this document.

This document is the source of truth.