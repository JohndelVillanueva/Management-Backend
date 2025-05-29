import prisma from '../utils/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
// import { transporter } from './email.service'; // Uncomment if using Nodemailer


export const authService = {
  async generateAndStoreToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.upsert({
      where: { token }, // Use the unique field 'token' as defined in your Prisma schema
      update: { token, expires },
      create: { user_id: userId, token, expires }
    });

    return token;
  },

  generateJWT(user: { id: number; email: string; user_type: string }, rememberMe: boolean): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        userType: user.user_type,
        isVerified: user.user_type === 'ADMIN' // Example: auto-verify admins
      },
      process.env.JWT_SECRET!,
      { expiresIn: rememberMe ? '7d' : '2h' }
    );
  },

  async verifyToken(token: string) {
    // Implementation for token verification
  }
};