import type { Context, Next } from "hono";
import jwt from "jsonwebtoken";

interface JwtPayload {
  userId: number;
  email: string;
  userType: string;
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

    // Attach user payload from JWT to context
    c.set("user", decoded);

    await next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
};
