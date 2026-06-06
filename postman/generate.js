const fs = require('fs');
const path = require('path');

const collections = {
  "PyramidEdu Auth": [
    { name: "Register Admin", method: "POST", url: "/api/v1/auth/register", body: { email: "admin@test.com", password: "Password123", fullName: "Admin Test", role: "ADMIN" }, description: "Register a new admin user." },
    { name: "Login", method: "POST", url: "/api/v1/auth/login", body: { email: "admin@test.com", password: "Password123" }, description: "Login and receive access and refresh tokens." },
    { name: "Get Me", method: "GET", url: "/api/v1/auth/me", auth: true, description: "Get the profile of the currently logged in user." },
    { name: "Change Password", method: "PATCH", url: "/api/v1/auth/change-password", auth: true, body: { currentPassword: "Password123", newPassword: "NewPassword123" }, description: "Change the password for the current user." },
    { name: "Refresh Token", method: "POST", url: "/api/v1/auth/refresh", body: { refreshToken: "your_refresh_token_here" }, description: "Get a new access token using a refresh token." },
    { name: "Logout", method: "POST", url: "/api/v1/auth/logout", body: { refreshToken: "your_refresh_token_here", logoutAll: false }, description: "Logout and invalidate the refresh token." }
  ],
  "PyramidEdu health": [
    { name: "Health Check", method: "GET", url: "/api/v1/health", description: "Check the health of the API server." }
  ],
  "PyramidEdu mobile": [
    { name: "Mobile Login", method: "POST", url: "/api/v1/mobile/auth/login", body: { email: "student@test.com", password: "Password123" }, description: "Login endpoint specifically for the mobile app." },
    { name: "Mobile Refresh", method: "POST", url: "/api/v1/mobile/auth/refresh", body: { refreshToken: "your_refresh_token_here" }, description: "Refresh token endpoint for the mobile app." }
  ],
  "PyramidEdu student": [
    { name: "Get Students", method: "GET", url: "/api/v1/students", auth: true, description: "List students with pagination and search." },
    { name: "Get Student By Id", method: "GET", url: "/api/v1/students/123", auth: true, description: "Get student details by ID." },
    { name: "Update Student", method: "PATCH", url: "/api/v1/students/123", auth: true, body: { address: "New Address", phone: "0712345678" }, description: "Update a student's profile." },
    { name: "Get Enrollments", method: "GET", url: "/api/v1/students/123/enrollments", auth: true, description: "Get all subject enrollments for a student." }
  ],
  "PyramidEdu Subjects": [
    { name: "Get Subjects", method: "GET", url: "/api/v1/subjects", description: "List all subjects." },
    { name: "Create Subject", method: "POST", url: "/api/v1/subjects", auth: true, body: { subjectName: "Mathematics", subjectCode: "MATH101", streamId: "uuid", grade: "10", fee: 1500 }, description: "Create a new subject." },
    { name: "Get Subject By Id", method: "GET", url: "/api/v1/subjects/123", description: "Get subject details." },
    { name: "Assign Teacher", method: "PATCH", url: "/api/v1/subjects/123/assign-teacher", auth: true, body: { teacherId: "uuid" }, description: "Assign a teacher to a subject." },
    { name: "Enroll Student", method: "POST", url: "/api/v1/subjects/123/enroll", auth: true, body: { studentId: "uuid", enrollmentType: "ONLINE" }, description: "Enroll a student in a subject." }
  ],
  "PyramidEdu teacher": [
    { name: "Get Teachers", method: "GET", url: "/api/v1/teachers", auth: true, description: "List all teachers." },
    { name: "Create Teacher", method: "POST", url: "/api/v1/teachers", auth: true, body: { email: "teacher@test.com", password: "Password123", fullName: "Teacher Test", nic: "987654321V", gender: "MALE", address: "Teacher Addr", phone: "0771122334" }, description: "Create a new teacher." },
    { name: "Get Teacher By Id", method: "GET", url: "/api/v1/teachers/123", auth: true, description: "Get teacher details." },
    { name: "Update Teacher", method: "PATCH", url: "/api/v1/teachers/123", auth: true, body: { phone: "0779988776" }, description: "Update teacher profile." },
    { name: "Get Teacher Subjects", method: "GET", url: "/api/v1/teachers/123/subjects", auth: true, description: "Get all subjects assigned to a teacher." }
  ],
  "PyramidEdu users": [
    { name: "Get Users", method: "GET", url: "/api/v1/users", auth: true, description: "List all users." },
    { name: "Create User", method: "POST", url: "/api/v1/users", auth: true, body: { role: "MANAGER", fullName: "Manager Test", email: "manager@test.com", password: "Password123", phone: "0770000000", nic: "123456789V", gender: "MALE", address: "Address" }, description: "Create a new user (Manager/Teacher/Student)." },
    { name: "Get User By Id", method: "GET", url: "/api/v1/users/123", auth: true, description: "Get user details." },
    { name: "Update User", method: "PATCH", url: "/api/v1/users/123", auth: true, body: { fullName: "Updated Name" }, description: "Update user profile." },
    { name: "Deactivate User", method: "PATCH", url: "/api/v1/users/123/deactivate", auth: true, description: "Deactivate a user account." },
    { name: "Activate User", method: "PATCH", url: "/api/v1/users/123/activate", auth: true, description: "Activate a user account." },
    { name: "Delete User", method: "DELETE", url: "/api/v1/users/123", auth: true, description: "Soft delete a user account." }
  ]
};

function formatAsText(items) {
  let content = "";
  for (const item of items) {
    content += `=== ${item.name} ===\n`;
    content += `URL: ${item.method} {{baseUrl}}${item.url}\n`;
    if (item.auth) {
      content += `Headers: Authorization: Bearer {{token}}\n`;
    }
    content += `Instruction: ${item.description}\n`;
    if (item.body) {
      content += `Body:\n${JSON.stringify(item.body, null, 2)}\n`;
    }
    content += `\n-------------------------------------------------\n\n`;
  }
  return content;
}

for (const [name, items] of Object.entries(collections)) {
  const filename = path.join(__dirname, `${name}.postman_collection.txt`);
  const content = formatAsText(items);
  fs.writeFileSync(filename, content);
  console.log(`Generated ${filename}`);
  
  // Clean up the .json version or .postman_collection.json if requested
  const jsonFile = path.join(__dirname, `${name}.postman_collection.json`);
  if (fs.existsSync(jsonFile)) {
    fs.unlinkSync(jsonFile);
  }
}
