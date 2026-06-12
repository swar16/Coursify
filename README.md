# Coursify

A backend API for a Learning Management System (LMS) built with Express, TypeScript, Prisma, and PostgreSQL.

## Features

### Authentication
- User signup and login
- Password hashing using bcrypt
- JWT-based authentication
- Role-based authorization (Student / Instructor)

### Course Management
- Create courses (Instructor only)
- Update courses (Instructor only)
- Delete courses (Instructor only)
- View all courses
- View course details by ID
- View instructor's own courses

### Course Purchases
- Purchase courses
- Prevent duplicate purchases
- View purchased courses

### Validation
- Request validation using Zod
- Type-safe API inputs

## Tech Stack

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL (Neon)
- JWT Authentication
- bcrypt
- Zod

## Database Schema

### User
- id
- email
- password
- role

### Course
- id
- title
- description
- price
- authorId

### Purchase
- id
- userId
- courseId

## API Endpoints

### Auth

| Method | Endpoint | Description |
|----------|------------|-------------|
| POST | /auth/signup | Register a user |
| POST | /auth/login | Login user |

### Courses

| Method | Endpoint | Description |
|----------|------------|-------------|
| GET | /courses | Get all courses |
| GET | /courses/:id | Get course by ID |
| POST | /courses | Create course |
| PUT | /courses/:id | Update course |
| DELETE | /courses/:id | Delete course |
| GET | /courses/my-courses | Get instructor courses |
| POST | /courses/:id/purchase | Purchase a course |
| GET | /courses/purchased | Get purchased courses |

## Running Locally

1. Clone the repository

```bash
git clone https://github.com/swar16/Coursify.git
```

2. Install dependencies

```bash
npm install
```

3. Configure environment variables

Create a `.env` file:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
```

4. Generate Prisma Client

```bash
npx prisma generate
```

5. Run database migrations

```bash
npx prisma migrate dev
```

6. Start the development server

```bash
npm run dev
```

## Future Improvements

- Pagination
- Course search and filtering
- Course categories
- Payment integration
- Enrollment tracking
- Unit and integration testing
- Docker deployment

---

Built while learning backend development with Express, Prisma, PostgreSQL, JWT, and TypeScript.