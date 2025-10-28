// routes/head.routes.ts
import { Hono } from "hono";
import {
  getDepartmentStats,
  getDepartmentActivity,
  getDepartmentDeadlines,
  getDepartmentCards,
  getDepartmentStaff
} from "../controllers/users/head/head_controller.js";

const headRoute = new Hono();

// HEAD middleware - add your authentication/authorization here
const isHead = async (c: any, next: any) => {
  // Example: Check if user is HEAD from JWT or session
  // const user = c.get('user');
  // if (user?.user_type !== 'HEAD') {
  //   return c.json({ error: 'Department head access required' }, 403);
  // }
  await next();
};

// Apply HEAD middleware to all routes
headRoute.use('*', isHead);

// Department Dashboard Routes
headRoute.get('/stats', getDepartmentStats);
headRoute.get('/activity', getDepartmentActivity);
headRoute.get('/deadlines', getDepartmentDeadlines);
headRoute.get('/cards', getDepartmentCards);
headRoute.get('/staff', getDepartmentStaff);

export default headRoute ;