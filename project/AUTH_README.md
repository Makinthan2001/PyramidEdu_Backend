# PyramidEdu — Authentication System

Complete JWT authentication and role-based authorization system for the PyramidEdu backend.

---

## Quick Setup

### 1. Install new dependencies

```bash
npm install bcryptjs jsonwebtoken cookie-parser zod
npm install -D @types/bcryptjs @types/jsonwebtoken @types/cookie-parser
```

### 2. Update .env

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Generate JWT secrets (run in your terminal):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run this **three times** — one value each for `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `JWT_RESET_SECRET`.

### 3. Update Prisma schema

Replace your `prisma/schema.prisma` with the one provided (`prisma/schema.prisma`).  
The only addition is the **`RefreshToken`** model and the `generator previewFeatures` line.

### 4. Run migration

```bash
npx prisma migrate dev --name add_refresh_tokens
npx prisma generate
```

### 5. Start the server

```bash
npm run dev
```

---

## File Structure

```
src/
├── app.ts                          ← Updated: added cookieParser + auth routes
├── types/
│   └── auth.types.ts               ← Shared TS interfaces (JwtPayload, SafeUser, etc.)
├── utils/
│   ├── AppError.ts                 ← Custom error class with HTTP status
│   ├── jwt.util.ts                 ← generateAccessToken, verifyRefreshToken, etc.
│   ├── password.util.ts            ← hashPassword, comparePasswords (bcrypt)
│   ├── crypto.util.ts              ← generateTokenFamily, hashToken (SHA-256)
│   └── validateEnv.ts              ← Updated: validates JWT secrets on startup
├── middleware/
│   ├── authenticate.ts             ← Verifies JWT — protects routes
│   ├── authorize.ts                ← RBAC — checks user role
│   ├── validate.ts                 ← Zod schema validator middleware
│   └── errorHandler.ts             ← Updated: handles AppError + Prisma errors
└── modules/
    └── auth/
        ├── index.ts                ← Barrel export for the auth router
        ├── controller/
        │   └── auth.controller.ts  ← HTTP layer (reads req, sets cookies, sends res)
        ├── service/
        │   └── auth.service.ts     ← Business logic (all DB + token operations)
        ├── routes/
        │   └── auth.routes.ts      ← Express router — wires validators + controller
        └── validators/
            └── auth.validator.ts   ← Zod schemas for all request bodies
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | Public | Create new user |
| POST | `/api/auth/login` | Public | Login, receive tokens |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/api/auth/logout` | Cookie | Logout current session |
| POST | `/api/auth/logout?all=true` | Cookie | Logout all devices |
| GET | `/api/auth/me` | Bearer | Get current user |
| PATCH | `/api/auth/change-password` | Bearer | Change password |
| POST | `/api/auth/forgot-password` | Public | Request reset email |
| POST | `/api/auth/reset-password` | Public | Complete reset |

---

## Request & Response Examples

### POST /api/auth/register

**Request:**
```json
{
  "email": "admin@pyramidedu.lk",
  "password": "Admin1234",
  "role": "ADMIN"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "data": {
    "user": {
      "id": 1,
      "email": "admin@pyramidedu.lk",
      "role": "ADMIN",
      "isActive": true,
      "createdAt": "2026-05-24T00:00:00.000Z"
    }
  }
}
```

---

### POST /api/auth/login

**Request:**
```json
{
  "email": "admin@pyramidedu.lk",
  "password": "Admin1234"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": { "id": 1, "email": "admin@pyramidedu.lk", "role": "ADMIN", "isActive": true },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
> The `refreshToken` is set as an **httpOnly cookie** — not in the JSON body.

---

### GET /api/auth/me

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "email": "admin@pyramidedu.lk", "role": "ADMIN", "isActive": true }
  }
}
```

---

### Validation Error (422)

```json
{
  "success": false,
  "message": "Validation failed.",
  "errors": [
    { "field": "email",    "message": "Please provide a valid email address." },
    { "field": "password", "message": "Password must be at least 8 characters." }
  ]
}
```

---

## Authentication Workflow

```
LOGIN FLOW
──────────
Client  →  POST /api/auth/login  { email, password }
Server  →  1. Find user by email
           2. bcrypt.compare(password, hash)
           3. Generate accessToken  (JWT, 15m, signed with ACCESS_SECRET)
           4. Generate refreshToken (JWT, 7d,  signed with REFRESH_SECRET)
           5. Hash refreshToken with SHA-256
           6. Store hash + tokenFamily in DB (refresh_tokens table)
           7. Set refreshToken in httpOnly cookie
           8. Return accessToken in JSON body

──────────────────────────────────────────────────────

PROTECTED ROUTE FLOW
─────────────────────
Client  →  GET /api/auth/me  (Authorization: Bearer <accessToken>)
Server  →  authenticate middleware:
           1. Extract token from header (or cookie)
           2. jwt.verify(token, ACCESS_SECRET)
           3. Attach decoded payload to req.user
           4. next() → controller runs

──────────────────────────────────────────────────────

REFRESH TOKEN FLOW (Rotation)
──────────────────────────────
Client  →  POST /api/auth/refresh  (refreshToken cookie)
Server  →  1. jwt.verify(token, REFRESH_SECRET)
           2. SHA-256 hash the token
           3. Look up hash in refresh_tokens table
           4. If NOT FOUND → reuse detected → delete ALL user tokens → 401
           5. If FOUND → delete old token row
           6. Generate new accessToken + refreshToken (same tokenFamily)
           7. Store new hash in DB
           8. Set new cookie, return new accessToken

──────────────────────────────────────────────────────

LOGOUT FLOW
────────────
Client  →  POST /api/auth/logout  (refreshToken cookie)
Server  →  1. Hash the refresh token
           2. Delete from DB (single row)  — or all rows if ?all=true
           3. Clear cookie
           4. Return 200
```

---

## Using RBAC in Future Routes

```typescript
import { authenticate } from '../middleware/authenticate';
import { authorize, adminOnly, adminOrManager, staffOnly } from '../middleware/authorize';
import { UserRole } from '@prisma/client';

// Only ADMIN
router.delete('/users/:id', authenticate, adminOnly, deleteUser);

// ADMIN or MANAGER
router.get('/students', authenticate, adminOrManager, listStudents);

// Any staff role
router.get('/dashboard', authenticate, staffOnly, getDashboard);

// Custom combination
router.post('/marks', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN), enterMarks);
```

---

## Password Rules

- Minimum 8 characters
- Maximum 72 characters (bcrypt limit)
- At least one uppercase letter (A–Z)
- At least one number (0–9)

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcryptjs with 12 salt rounds |
| Token storage | Only hashed (SHA-256) refresh tokens stored in DB |
| Token rotation | Old refresh token deleted and new one issued on every refresh |
| Reuse detection | Missing token hash → delete all sessions → 401 |
| httpOnly cookies | Refresh token never accessible to JavaScript |
| Secure cookies | `secure: true` in production (HTTPS only) |
| SameSite | `strict` — CSRF protection |
| Short access tokens | 15-minute expiry limits exposure window |
| Token family | Ties all refreshes of one session together for reuse detection |
| Email enumeration | Login and forgot-password use identical error messages |
| Prisma parameterized | All DB queries use prepared statements — no SQL injection |
| CORS credentials | `credentials: true` required for cross-origin cookie sending |
