import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Context, Next } from 'hono';
import prisma from '../utils/db.js'; // Adjust the import path

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const VERIFICATION_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface UserPayload {
  id: string | number;
  email: string;
  userType: 'ADMIN' | 'HEAD' | 'STAFF';
  isVerified?: boolean;
}

// Generate JWT token
export function generateToken(user: UserPayload) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      userType: user.userType,
      isVerified: user.isVerified || false
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Compare password with hash
export async function verifyPassword(input: string, hashed: string) {
  return bcrypt.compare(input, hashed);
}

// Generate and store verification token
export async function generateVerificationToken(userId: string | number, email: string) {
  const token =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);

  const expires = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY);

  await prisma.verificationToken.create({
    data: {
      user_id: Number(userId),
      token,
      expires,
    },
  });

  return token;
}

// Verify token from database
export async function verifyUserToken(token: string) {
  const verificationToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!verificationToken) {
    throw new Error('Invalid verification token');
  }

  if (verificationToken.expires < new Date()) {
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
    throw new Error('Verification token has expired');
  }

  const updatedUser = await prisma.user.update({
    where: { id: verificationToken.user_id },
    data: { verified: true }, // Adjust field name if needed
  });

  await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

  return updatedUser;
}

// Middleware to check if email is verified
export async function checkVerification(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    return c.json({ error: 'No token provided' }, 401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;

    if (!decoded.isVerified) {
      return c.json(
        {
          error: 'Email not verified',
          code: 'EMAIL_NOT_VERIFIED',
        },
        403
      );
    }

    // Optionally attach decoded payload to context for use in route handler
    c.set('user', decoded);

    await next();
  } catch (error) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}
