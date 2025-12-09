import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
export const env = {
    port: Number(process.env.PORT) || 8000,
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
};
//# sourceMappingURL=env.js.map