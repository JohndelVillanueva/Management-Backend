import type { Context } from "hono";
import argon2 from "argon2";
import prisma from "../../utils/db.js";
import { generateToken } from "../../utils/jwt.js";

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

export const signup = async (c: Context) => {
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

    const token = generateToken(user.id, user.user_type);

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
