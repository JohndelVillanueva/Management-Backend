import type { Context } from "hono";
import * as argon2 from 'argon2'
import prisma from "../../utils/db.js";
import { 
  generateToken, 
  verifyPassword,
  generateVerificationToken 
} from '../../utils/auth.js';
import jwt from "jsonwebtoken";
import crypto from "crypto";

const mapInputToEnum = {
  ADMIN: "ADMIN",
  HEAD: "HEAD",
  STAFF: "STAFF",
};

function mapUserType(input: string) {
  const upperInput = input.toUpperCase();
  if (!["ADMIN", "HEAD", "STAFF"].includes(upperInput)) {
    throw new Error(`Invalid userType: ${input}`);
  }
  return upperInput;
}


export const signupController = async (c: Context) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
      userType, // e.g., 'Admin' or 'Staff'
      phoneNumber,
      username,
      department, // Added here
    } = await c.req.json();
    const prismaUserType = mapUserType(userType);

    // Validate userType matches enum
    if (!["ADMIN", "STAFF", "HEAD"].includes(userType)) {
      return c.json(
        {
          error: "Invalid user type",
          details: `Received: ${userType}, Expected: ADMIN, HEAD, or STAFF`,
        },
        400
      );
    }

    // Validate passwords
    if (password !== confirmPassword) {
      return c.json({ error: "Passwords do not match" }, 400);
    }

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return c.json({ error: "Email or Username already in use" }, 400);
    }

    // Hash password with argon2 (fast and secure)
    const hashedPassword = await argon2.hash(password);

    // Create user with department
    const user = await prisma.user.create({
      data: {
        username,
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        user_type: userType,
        department, // Included here
      },
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      userType: user.user_type,
      isVerified: user.is_verified ?? false
    });

    return c.json(
      {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        username: user.username,
        userType: user.user_type,
        department,
        token,
      },
      201
    );
  } catch (error) {
    console.error(error);
    return c.json({ error: "Server error" }, 500);
  }
};

// export const loginController = async (c: Context) => {

//   try {
//     const { email, password, rememberMe } = await c.req.json();

//     // 1. Validate input
//     if (!email || !password) {
//       return c.json({ 
//         success: false,
//         message: 'Email and password are required' 
//       }, 400);
//     }

//     // 2. Find user by email
//     const user = await prisma.user.findUnique({
//       where: { email },
//       select: {
//         id: true,
//         email: true,
//         username: true,
//         password_hash: true,
//         user_type: true,
//         first_name: true,
//         last_name: true,
//         is_active: true,
//         department: true,
//         last_login: true,
//       }
//     });

//     // 3. Check if user exists and is active
//     if (!user) {
//       return c.json({
//         success: false,
//         message: 'Invalid credentials'
//       }, 401);
//     }

//     if (!user.is_active) {
//       return c.json({
//         success: false,
//         message: 'Account is deactivated. Please contact administrator.'
//       }, 403);
//     }

//     // 4. Verify password using Argon2
//     const isPasswordValid = await argon2.verify(
//       user.password_hash,  // stored hash
//       password             // plaintext password
//     );
    
//     if (!isPasswordValid) {
//       return c.json({
//         success: false,
//         message: 'Invalid credentials'
//       }, 401);
//     }

//     // 5. Prepare user data for token
//     const userData = {
//       id: user.id,
//       email: user.email,
//       username: user.username,
//       user_type: user.user_type,
//       name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
//       department: user.department
//     };

//     // 6. Generate JWT token with rememberMe consideration
//     const token = jwt.sign(
//       { 
//         userId: user.id, 
//         ...userData 
//       },
//       process.env.JWT_SECRET || 'your-secret-key-here',
//       { expiresIn: rememberMe ? '7d' : '2h' }
//     );

//     // 7. Update last login timestamp
//     await prisma.user.update({
//       where: { id: user.id },
//       data: { last_login: new Date() }
//     });

//     // 8. Return success response with token
//     return c.json({
//       success: true,
//       message: 'Login successful',
//       token,
//       user: userData,
//       lastLogin: user.last_login,
//     });

//   } catch (error) {
//     console.error('Login error:', error);
//     return c.json({
//       success: false,
//       message: 'An error occurred during login'
//     }, 500);
//   }
// };

export const loginController = async (c: Context) => {
  try {
    const { email, password, rememberMe } = await c.req.json();

    // 1. Validate input
    if (!email || !password) {
      return c.json({ 
        success: false,
        message: 'Email and password are required' 
      }, 400);
    }

    // 2. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        password_hash: true,
        user_type: true,
        first_name: true,
        last_name: true,
        is_active: true,
        is_verified: true, // Added verification status
        department: true,
        last_login: true,
      }
    });

    // 3. Check if user exists and is active
    if (!user) {
      return c.json({
        success: false,
        message: 'Invalid credentials'
      }, 401);
    }

    if (!user.is_active) {
      return c.json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      }, 403);
    }

    // 4. Verify password using Argon2
    const isPasswordValid = await argon2.verify(
      user.password_hash,
      password
    );
    
    if (!isPasswordValid) {
      return c.json({
        success: false,
        message: 'Invalid credentials'
      }, 401);
    }

    // 5. Check if user is verified
    if (!user.is_verified) {
      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store verification token
      await prisma.verificationToken.upsert({
        where: { token: verificationToken },
        update: { 
          token: verificationToken,
          expires: expiresAt,
          createdAt: new Date() 
        },
        create: {
          user_id: user.id,
          token: verificationToken,
          expires: expiresAt
        }
      });

      // TODO: Send verification email here with the token
      // Example: await sendVerificationEmail(user.email, verificationToken);

      return c.json({
        success: false,
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
        userId: user.id,
        // Don't return the actual token in production - just for demo
        resendToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      }, 403);
    }

    // 6. Prepare user data for token
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      user_type: user.user_type,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      department: user.department,
      is_verified: user.is_verified // Include verification status
    };

    // 7. Generate JWT token with rememberMe consideration
    const token = jwt.sign(
      { 
        userId: user.id, 
        ...userData 
      },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: rememberMe ? '7d' : '2h' }
    );

    // 8. Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() }
    });

    // 9. Return success response with token
    return c.json({
      success: true,
      message: 'Login successful',
      token,
      user: userData,
      lastLogin: user.last_login,
    });

  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      success: false,
      message: 'An error occurred during login'
    }, 500);
  }
};


export const logoutController = async (c: Context) => {
  // Clear the JWT cookie (or any auth-related cookie)
  c.header('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0')

  return c.json({ message: 'Logged out successfully' })
}