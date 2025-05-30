import type { Context } from "hono";
import * as argon2 from "argon2";
import prisma from "../../utils/db.js";
import {
  generateToken,
  verifyPassword,
  generateVerificationToken,
} from "../../utils/auth.js";
import jwt from "jsonwebtoken";
import { authService } from "../../services/auth.service.js";
import { emailService } from "../../services/email.service.js";
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
      isVerified: user.is_verified ?? false,
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
    console.log("Login attempt for email:", email);

    // 1. Validate input
    if (!email || !password) {
      return c.json(
        { success: false, message: "Email and password are required" },
        400
      );
    }

    // 2. Find user by email
    console.log("Looking for user in database...");
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
        is_verified: true,
        department: true,
        last_login: true,
        verificationTokens: {
          select: { token: true, expires: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    console.log(
      "User found:",
      user
        ? {
            id: user.id,
            is_active: user.is_active,
            is_verified: user.is_verified,
          }
        : "No user found"
    );

    // 3. Check if user exists and is active
    if (!user) {
      console.log("User not found for email:", email); // Add this
      return c.json({ success: false, message: "Invalid credentials" }, 401);
    }

    if (!user.is_active) {
      console.log("User account inactive:", email);
      return c.json(
        {
          success: false,
          message: "Account is deactivated. Please contact administrator.",
        },
        403
      );
    }

    // 4. Verify password
    console.log("Verifying password..."); // Add this
    const isPasswordValid = await argon2.verify(user.password_hash, password);
    if (!isPasswordValid) {
      console.log("User not verified - starting verification flow"); // Add this
      return c.json({ success: false, message: "Invalid credentials" }, 401);
    }

    // 5. Handle unverified users
    if (!user.is_verified) {
      console.log("Unverified user flow started for:", user.email);

      const existingToken = user.verificationTokens[0];
      const isTokenValid =
        existingToken && new Date(existingToken.expires) > new Date();

      console.log("Token check:", {
        hasExistingToken: !!existingToken,
        isTokenValid,
        tokenExpiry: existingToken?.expires,
      });

      const verificationToken = isTokenValid
        ? existingToken.token
        : await authService.generateAndStoreToken(user.id);

      console.log("Using verification token:", verificationToken);

      try {
        console.log("Attempting to send verification email to:", user.email);
        await emailService.sendVerificationEmail(
          user.email,
          verificationToken,
          String(user.id)
        );
        console.log("Verification email sent successfully");

        return c.json(
          {
            success: false,
            code: "USER_NOT_VERIFIED",
            message: "Account not verified. Verification email sent.",
            email: user.email,
          },
          403
        );
      } catch (emailError) {
        console.error("FAILED to send verification email:", emailError);
        return c.json(
          {
            success: false,
            code: "EMAIL_SEND_FAILED",
            message: "Account not verified. Failed to send verification email.",
          },
          403
        );
      }
    }

    // 6. Prepare user data for token
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      user_type: user.user_type,
      name: `${user.first_name || ""} ${user.last_name || ""}`.trim(),
      department: user.department,
      is_verified: user.is_verified,
    };

    // 7. Generate JWT token
    const token = jwt.sign(
      { userId: user.id, ...userData },
      process.env.JWT_SECRET || "your-secret-key-here",
      { expiresIn: rememberMe ? "7d" : "2h" }
    );

    // 8. Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    // 9. Return success response
    return c.json({
      success: true,
      message: "Login successful",
      token,
      user: userData,
      lastLogin: user.last_login,
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json(
      { success: false, message: "An error occurred during login" },
      500
    );
  }
};

export const logoutController = async (c: Context) => {
  // Clear the JWT cookie
  c.header(
    "Set-Cookie",
    "token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    // Add 'Domain=yourdomain.com' if needed
  );

  return c.json({ message: "Logged out successfully" });
};

export const verifyEmailController = async (c: Context) => {
  try {
     const { token, userId } = c.req.query(); // Get both params
if (!token || !userId) {
      return c.json(
        { success: false, message: "Token and userId are required" },
        400
      );
    }

    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (
      !verificationToken ||
      verificationToken.user_id !== Number(userId)
    ) {
      return c.json(
        { success: false, message: "Invalid verification token" },
        400
      );
    }
    

    if (verificationToken.expires < new Date()) {
      await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      return c.json({ success: false, message: "Verification token expired" }, 400);
    }

    if (!verificationToken.user.is_verified) {
      await prisma.user.update({
        where: { id: verificationToken.user_id },
        data: { is_verified: true },
      });
      console.log(`✅ User ${verificationToken.user_id} marked as verified`);
    } else {
      console.log(`ℹ️ User ${verificationToken.user_id} already verified`);
    }

    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    const userData = verificationToken.user;

    const tokenJWT = jwt.sign(
      {
        userId: userData.id,
        email: userData.email,
        username: userData.username,
        user_type: userData.user_type,
        name: `${userData.first_name || ""} ${userData.last_name || ""}`.trim(),
        department: userData.department,
        is_verified: true,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "2h" }
    );

    return c.json({
      success: true,
      message: "Email verified successfully",
      token: tokenJWT,
      user: {
        id: userData.id,
        email: userData.email,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        userType: userData.user_type,
        department: userData.department,
        isVerified: true,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return c.json({ success: false, message: "Email verification failed" }, 500);
  }
};



export const resendVerification = async (c: Context) => {
  try {
    const { email } = await c.req.json();

    // 1. Fetch user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return c.json({ success: false, message: "User not found" }, 404);
    }

    if (user.is_verified) {
      return c.json({ success: false, message: "Email already verified" }, 400);
    }

    // 2. Delete existing tokens for user (cleanup)
    await prisma.verificationToken.deleteMany({
      where: { user_id: user.id },
    });

    // 3. Generate a new token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 4. Save new token
    await prisma.verificationToken.create({
      data: {
        token: verificationToken,
        user_id: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    // 5. Send email
    await emailService.sendVerificationEmail(
      user.email,
      verificationToken,
      String(user.id)
    );

    return c.json({ success: true, message: "Verification email resent" });
  } catch (error) {
    console.error("Resend verification error:", error);
    return c.json(
      { success: false, message: "Failed to resend verification email" },
      500
    );
  }
};

export const forgotPassword = async (c: Context) => {
  try {
    const { email } = await c.req.json();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const resetToken = generateToken({
      id: user.id,
      email: user.email,
      userType: user.user_type,
      isVerified: user.is_verified ?? false,
    });

    await prisma.passwordResetToken.upsert({
      where: { user_id: user.id },
      update: {
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
      create: {
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user_id: user.id,
      },
    });

    await emailService.sendPasswordResetEmail(email, resetToken);
    return c.json({ success: true });
  } catch (error) {
    console.error("Password reset error:", error);
    return c.json({ error: "Failed to send password reset email" }, 500);
  }
};
