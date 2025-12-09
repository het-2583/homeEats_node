import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 8000,
  jwtSecret: process.env.JWT_SECRET || 'super-secret-change-me',
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};