# Users Module - User Account Management

Manages the foundational user account layer shared across all roles. Handles user account creation, retrieval, updates, deactivation, and role-based access control. This is the core identity layer that all role-specific modules build upon.

## Directory Structure

```
modules/users/
├── controller/
│   └── users.controller.ts          # HTTP request handlers
├── service/
│   └── users.service.ts             # Business logic & database operations
├── routes/
│   └── users.routes.ts              # API endpoint definitions
├── validators/
│   └── users.validator.ts           # Validation schemas (barrel re-exports from dto/)
├── dto/                             # Data Transfer Objects
│   ├── create-user.dto.ts           # Role-specific creation DTOs
│   ├── update-user.dto.ts           # User update DTO
│   └── index.ts                     # Barrel exports
├── guards/
│   └── users.guard.ts               # Role-based access control guards
├── README.md                        # This file
└── index.ts                         # Module export
```

## Features

✅ **Create user account** - Role-based creation with specific forms per role
✅ **Retrieve users** - Get by ID, email, with filtering and pagination
✅ **Update user details** - Edit account information based on role
✅ **Soft-delete** - Deactivate user account (no permanent deletion)
✅ **Activate/Deactivate** - Toggle user account status
✅ **Role-based filtering** - Filter by MANAGER, TEACHER, STUDENT, SUPPORT_STAFF
✅ **Role-based access control** - ADMIN > MANAGER > Authenticated users
✅ **Audit logging** - Track all user changes
✅ **Pagination & search** - List users with filtering and pagination

## API Endpoints

All routes require JWT authentication.

### List Users

```
GET /api/v1/users
Query Parameters:
  - page: number (default: 1)
  - limit: number (default: 10)
  - search: string (search by email, name, phone)
  - role: 'all' | 'managers' | 'teachers' | 'students' | 'supportStaff' | 'admins'
  - status: 'ACTIVE' | 'DISABLED'

Example:
GET /api/v1/users?role=students&status=ACTIVE&page=1&limit=20

Response:
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": {
    "data": [...],
    "total": 45,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

### Get User by ID

```
GET /api/v1/users/:id

Response:
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "role": "STUDENT",
    "isActive": true,
    "firstName": "John",
    "lastName": "Doe",
    "indexNumber": "2024-001",
    ...
  }
}
```

### Create User

```
POST /api/v1/users
Content-Type: application/json

Body (varies by role):

MANAGER:
{
  "role": "MANAGER",
  "fullName": "John Manager",
  "department": "Computer Science",
  "email": "manager@example.com",
  "phoneNumber": "1234567890",
  "password": "SecurePass@123"
}

TEACHER:
{
  "role": "TEACHER",
  "firstName": "Jane",
  "lastName": "Teacher",
  "subject": "Mathematics",
  "email": "teacher@example.com",
  "phoneNumber": "1234567890",
  "salary": 50000,
  "password": "SecurePass@123"
}

STUDENT:
{
  "role": "STUDENT",
  "firstName": "Bob",
  "lastName": "Student",
  "indexNumber": "2024-001",
  "parentName": "Parent Name",
  "parentPhone": "9876543210",
  "address": "123 Main St, City",
  "email": "student@example.com",
  "phoneNumber": "1234567890",
  "password": "SecurePass@123"
}

SUPPORT_STAFF:
{
  "role": "SUPPORT_STAFF",
  "fullName": "Support Person",
  "roleType": "Counselor",
  "email": "support@example.com",
  "phoneNumber": "1234567890",
  "salary": 35000,
  "password": "SecurePass@123"
}

Response (201 Created):
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 5,
    "email": "student@example.com",
    "role": "STUDENT",
    "isActive": true,
    "createdAt": "2026-05-26T10:30:00.000Z"
  }
}
```

### Update User

```
PATCH /api/v1/users/:id
Content-Type: application/json

Body (optional fields):
{
  "email": "newemail@example.com",
  "phoneNumber": "9999999999",
  "firstName": "Updated",
  "lastName": "Name",
  "subject": "Physics",
  "salary": 55000,
  ...
}

Response:
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 1,
    "email": "newemail@example.com",
    "role": "TEACHER",
    "isActive": true,
    "updatedAt": "2026-05-26T11:30:00.000Z"
  }
}
```

### Delete User (Soft Delete)

```
DELETE /api/v1/users/:id

Response:
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "id": 1,
    "email": "user@example.com"
  }
}
```

### Deactivate User

```
PATCH /api/v1/users/:id/deactivate

Response:
{
  "success": true,
  "message": "User deactivated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "isActive": false
  }
}
```

### Activate User

```
PATCH /api/v1/users/:id/activate

Response:
{
  "success": true,
  "message": "User activated successfully",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "isActive": true
  }
}
```

## Role-Based Filtering

### Filter by Role

```bash
# Get all managers
GET /api/v1/users?role=managers

# Get all teachers
GET /api/v1/users?role=teachers

# Get all students
GET /api/v1/users?role=students

# Get all support staff
GET /api/v1/users?role=supportStaff

# Get all admins
GET /api/v1/users?role=admins

# Get all users (default)
GET /api/v1/users?role=all
```

### Filter by Status

```bash
# Get only active users
GET /api/v1/users?status=ACTIVE

# Get only disabled users
GET /api/v1/users?status=DISABLED
```

### Combined Filters

```bash
# Get active students with pagination
GET /api/v1/users?role=students&status=ACTIVE&page=1&limit=20

# Search for student by name
GET /api/v1/users?role=students&search=John
```

## Role-Based Access Control

### ADMIN

- ✅ Can create all roles (ADMIN, MANAGER, TEACHER, STUDENT, SUPPORT_STAFF)
- ✅ Can list all users
- ✅ Can update all users
- ✅ Can delete all users
- ✅ Can activate/deactivate all users
- ✅ Can even deactivate themselves

### MANAGER

- ✅ Can create only STUDENT users
- ✅ Can list only STUDENT users
- ✅ Can update only STUDENT users
- ✅ Can delete only STUDENT users
- ❌ Cannot access MANAGER, TEACHER, SUPPORT_STAFF, or ADMIN users
- ❌ Cannot create other roles

### TEACHER / SUPPORT_STAFF / STUDENT

- ✅ Can access their own profile (GET /api/v1/users/:id where id = their ID)
- ✅ Can update their own profile
- ❌ Cannot list other users
- ❌ Cannot create users
- ❌ Cannot delete users

## Role-Specific DTOs

### MANAGER Creation DTO

```typescript
{
  fullName: string;
  department: string;
  email: string;
  phoneNumber: string;
  password: string;
}
```

### TEACHER Creation DTO

```typescript
{
  firstName: string;
  lastName: string;
  subject: string;
  email: string;
  phoneNumber: string;
  salary?: number;
  password: string;
}
```

### STUDENT Creation DTO

```typescript
{
  firstName: string;
  lastName: string;
  indexNumber: string;
  parentName: string;
  parentPhone: string;
  address: string;
  email: string;
  phoneNumber: string;
  password: string;
}
```

### SUPPORT_STAFF Creation DTO

```typescript
{
  fullName: string;
  roleType: string;
  email: string;
  phoneNumber: string;
  salary?: number;
  password: string;
}
```

### ADMIN Creation DTO

```typescript
{
  role: 'ADMIN' | 'MANAGER' | 'TEACHER' | 'STUDENT' | 'SUPPORT_STAFF';
  email: string;
  password: string;
  // All optional fields based on role
  fullName?: string;
  department?: string;
  firstName?: string;
  lastName?: string;
  subject?: string;
  indexNumber?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  roleType?: string;
  phoneNumber?: string;
  salary?: number;
}
```

### Update User DTO

```typescript
{
  email?: string;
  phoneNumber?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  subject?: string;
  indexNumber?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  roleType?: string;
  salary?: number;
}
```

## Validation Rules

### Password Strength

- Minimum 8 characters, maximum 72 characters
- Must contain at least one uppercase letter
- Must contain at least one number
- Must contain at least one special character (@$!%\*?&)

### Email

- Valid email format
- Maximum 255 characters
- Must be unique across all users

### Phone Numbers

- Minimum 10 digits

### Role

- Must be one of: ADMIN, MANAGER, TEACHER, STUDENT, SUPPORT_STAFF

## Guards (Role-Based Access)

### `canManageUsers`

Only ADMIN and MANAGER can manage users (create, update, delete, etc.)

### `canCreateRole`

- ADMIN: can create all roles
- MANAGER: can only create STUDENT users
- Others: forbidden

### `canAccessUser`

- ADMIN: can access any user
- Others: can only access their own profile

### `preventSelfDeactivation`

- ADMIN: can deactivate anyone including themselves
- Others: cannot deactivate their own account

## Audit Logging

All user operations are logged:

- `USER_CREATED` - When new user is created
- `USER_UPDATED` - When user details are updated
- `USER_DELETED` - When user is deleted (soft delete)
- `USER_ACTIVATED` - When user is activated
- `USER_DEACTIVATED` - When user is deactivated

Example audit log entry:

```json
{
  "id": "abc123",
  "action": "USER_CREATED",
  "userId": 5,
  "resourceType": "USER",
  "resourceId": 5,
  "details": "User student@example.com created with role STUDENT",
  "createdAt": "2026-05-26T10:30:00.000Z"
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Validation error or invalid request",
  "errors": [...]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Authentication required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "You do not have permission to access this resource"
}
```

### 404 Not Found

```json
{
  "success": false,
  "message": "User not found"
}
```

### 409 Conflict

```json
{
  "success": false,
  "message": "Email already in use"
}
```

## cURL Examples

### List all active students

```bash
curl -X GET "http://localhost:5000/api/v1/users?role=students&status=ACTIVE" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Create a new student

```bash
curl -X POST "http://localhost:5000/api/v1/users" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "STUDENT",
    "firstName": "John",
    "lastName": "Doe",
    "indexNumber": "2024-001",
    "parentName": "Jane Doe",
    "parentPhone": "9876543210",
    "address": "123 Main St, City",
    "email": "john.doe@example.com",
    "phoneNumber": "1234567890",
    "password": "SecurePass@123"
  }'
```

### Update user profile

```bash
curl -X PATCH "http://localhost:5000/api/v1/users/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "9999999999",
    "email": "newemail@example.com"
  }'
```

### Deactivate user

```bash
curl -X PATCH "http://localhost:5000/api/v1/users/1/deactivate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### Activate user

```bash
curl -X PATCH "http://localhost:5000/api/v1/users/1/activate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## Security Considerations

1. **JWT Required**: All endpoints require JWT authentication
2. **Role-Based Access**: Proper access control enforced at guard level
3. **Email Uniqueness**: Prevents duplicate emails
4. **Password Hashing**: Passwords hashed with bcrypt
5. **Soft Delete**: Users are never permanently deleted, just deactivated
6. **Audit Trail**: All modifications are logged
7. **Self-Deactivation**: Non-admins cannot deactivate themselves

## Testing

### Test with Postman Collection

Import the users API collection in Postman for easy testing of all endpoints.

### Manual Testing

1. Authenticate with a user token
2. Test list endpoint with different role filters
3. Test role-based access by trying to access restricted resources
4. Test creation of users in different roles
5. Verify audit logs are created for each operation

## Related Documentation

- [Auth Module](../auth/README.md) - Authentication and JWT
- [Health Module](../health/README.md) - System health checks
- [Database Schema](#prisma-models) - User and AuditLog models
