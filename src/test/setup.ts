process.env.NODE_ENV = 'test';

// Tests must never touch the development or production database.
process.env.DATABASE_URL = 'postgresql://postgres@localhost:6000/task_auth_test?schema=public';
process.env.JWT_SECRET = 'test-jwt-secret-which-is-long-enough-0123456789';
process.env.JWT_EXPIRES_IN = '15m';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.BACKEND_URL = 'http://localhost:3001';
process.env.PORT = '3001';

// Prevent tests from sending real email using credentials from .env.
process.env.SMTP_HOST = '';
process.env.SMTP_PORT = '587';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.SMTP_FROM = '';
