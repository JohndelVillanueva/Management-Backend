import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: number;
  id?: number; // Add id for backward compatibility
  email: string;
  userType: string;
  user_type?: string; // Add user_type for backward compatibility
  isVerified?: boolean;
  iat?: number;
  exp?: number;
}

export const authMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized: No token provided" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;

    // Ensure we have a valid user ID (prefer userId, fallback to id)
    const userId = decoded.userId || decoded.id;
    if (!userId) {
      return c.json({ error: "Unauthorized: Invalid token payload" }, 401);
    }

    // Ensure we have a valid user type (prefer userType, fallback to user_type)
    const userType = decoded.userType || decoded.user_type;
    if (!userType) {
      return c.json({ error: "Unauthorized: Invalid token payload - missing user type" }, 401);
    }

    // Attach user payload from JWT to context with normalized fields
    c.set("user", { ...decoded, userId, userType });

    await next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
};
