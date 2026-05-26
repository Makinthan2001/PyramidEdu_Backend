# Auth Module - Reorganized Structure

Complete authentication module for PyramidEdu with JWT-based authentication, role management, and password reset functionality.

## New Directory Structure

```
modules/auth/
├── controller/
│   └── auth.controller.ts          # HTTP request handlers
├── service/
│   └── auth.service.ts             # Business logic & database operations
├── routes/
│   └── auth.routes.ts              # API endpoint definitions
├── validators/
│   └── auth.validator.ts           # Validation schemas (register, refresh)
├── dto/                            # Data Transfer Objects
│   ├── login.dto.ts                # Login DTO & schema
│   ├── forgot-password.dto.ts      # Forgot password DTO & schema
│   ├── reset-password.dto.ts       # Reset password DTO & schema
│   ├── change-password.dto.ts      # Change password DTO & schema
│   └── index.ts                    # Barrel exports
├── guards/                         # Authorization guards
│   ├── jwt.guard.ts                # JWT verification guard
│   ├── role.guard.ts               # Role-based authorization guards
│   └── index.ts                    # Barrel exports
└── index.ts                        # Module export
```

## File Organization

### Validators (`validators/`)

- **auth.validator.ts**: Core validation schemas for register and refresh token
  - `registerSchema`: Validates registration request
  - `refreshTokenSchema`: Validates refresh token request
  - `RegisterDto`: Type for register DTO

### DTOs (`dto/`)

Each DTO file contains schema and TypeScript types for specific endpoints:

#### login.dto.ts

```typescript
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;
```

#### forgot-password.dto.ts

```typescript
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
```

#### reset-password.dto.ts

```typescript
export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordField,
  confirmPassword: z.string().min(1),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
```

#### change-password.dto.ts

```typescript
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordField,
  confirmPassword: z.string().min(1),
});
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
```

### Guards (`guards/`)

Middleware for authentication and authorization:

#### jwt.guard.ts

- `jwtGuard`: Main JWT verification middleware
  - Extracts bearer token from Authorization header
  - Verifies JWT signature and expiry
  - Attaches user data to request object
  - Usage: `router.use(jwtGuard)` or `router.get('/protected', jwtGuard, handler)`

#### role.guard.ts

- `roleGuard(...roles)`: Role-based authorization
  - Checks if user has required role
  - Returns 403 Forbidden if insufficient permissions
  - Usage: `router.get('/admin', roleGuard(UserRole.ADMIN), handler)`

- `adminOnly`: Restrict to admin users only
- `managerOrAdmin`: Restrict to admin or manager users

## API Endpoints

### Public Routes

#### Register

```
POST /api/auth/register
Body: { email, password, role }
Response: { success, message, data: { user } }
```

#### Login

```
POST /api/auth/login
Body: { email, password }
Response: { success, message, data: { user, accessToken } }
```

#### Check Email Availability

```
POST /api/auth/check-email
Body: { email }
Response: { success, data: { exists: boolean } }
```

### Protected Routes (Require JWT)

#### Get Current User

```
GET /api/auth/me
Headers: { Authorization: "Bearer JWT_TOKEN" }
Response: { success, message, data: user }
```

#### Refresh Token

```
POST /api/auth/refresh
Cookies: { refreshToken }
Response: { success, message, data: { accessToken } }
```

#### Change Password

```
PATCH /api/auth/change-password
Headers: { Authorization: "Bearer JWT_TOKEN" }
Body: { currentPassword, newPassword, confirmPassword }
Response: { success, message }
```

#### Forgot Password

```
POST /api/auth/forgot-password
Body: { email }
Response: { success, message }
```

#### Reset Password

```
POST /api/auth/reset-password
Body: { token, newPassword, confirmPassword }
Response: { success, message }
```

#### Logout

```
POST /api/auth/logout?all=false
Headers: { Authorization: "Bearer JWT_TOKEN" }
Response: { success, message }
```

## Usage Examples

### Import DTOs for validation

```typescript
import {
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from "../dto";
```

### Import Guards for protection

```typescript
import { jwtGuard, roleGuard, adminOnly, managerOrAdmin } from "../guards";

// Use in routes
router.get("/admin-only", jwtGuard, adminOnly, handler);
router.post("/user-management", jwtGuard, roleGuard(UserRole.MANAGER), handler);
```

### Using in Controller

```typescript
import type { LoginDto } from "../dto/login.dto";

export async function login(req: Request, res: Response, next: NextFunction) {
  const dto = req.body as LoginDto;
  // ... handler logic
}
```

## Middleware Chain

For protected routes, the middleware chain is:

1. `validate(schema)` - Validate request body
2. `jwtGuard` - Verify JWT token
3. `roleGuard(...)` - Check user role (optional)
4. Handler function

Example:

```typescript
router.post(
  "/admin-action",
  validate(actionSchema), // 1. Validate request
  jwtGuard, // 2. Verify JWT
  roleGuard(UserRole.ADMIN), // 3. Check role
  controller.adminAction, // 4. Execute handler
);
```

## Authentication Flow

### Registration & Login

```
1. User registers with email, password, role
2. Password is hashed and stored
3. User logs in with email and password
4. Access token and refresh token are generated
5. Refresh token is stored as HTTP-only cookie
```

### Token Refresh

```
1. Access token expires
2. Client sends refresh token (from cookie or header)
3. Server validates refresh token
4. New access token is issued
5. New refresh token replaces old one (token rotation)
```

### Password Reset

```
1. User requests password reset with email
2. Reset token is generated and sent to email
3. User clicks link with token and new password
4. Server validates token and updates password
```

## Password Validation Rules

- Minimum 8 characters, maximum 72 characters
- Must contain at least one uppercase letter
- Must contain at least one number
- Special characters optional but recommended

## Error Handling

All errors return proper HTTP status codes:

```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE"
}
```

**Common Status Codes:**

- `400`: Validation error
- `401`: Authentication failed (invalid credentials or token)
- `403`: Forbidden (insufficient permissions)
- `409`: Conflict (email already exists)
- `500`: Server error

## Notes

- JWT tokens are signed with HS256 algorithm
- Access token expires in 15 minutes (configurable)
- Refresh token expires in 7 days (configurable)
- Tokens are JWT format, no database lookup on validation
- Refresh token family tracking prevents token reuse attacks
- All passwords are hashed with bcrypt
