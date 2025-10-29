// routes/acitivities.route.ts
import { Hono } from "hono";
import {
  getOverviewStats,
  getRealtimeMetrics,
  getAllCardsWithProgress,
  getDepartmentStats,
  getRecentActivity,
  getDepartmentStorage  // Add this import
} from "../controllers/activities/activities_controller.js";

const activitiesRoute = new Hono();

// Admin middleware - add your authentication/authorization here
const isAdmin = async (c: any, next: any) => {
  // Example: Check if user is admin from JWT or session
  // const user = c.get('user');
  // if (user?.user_type !== 'ADMIN') {
  //   return c.json({ error: 'Admin access required' }, 403);
  // }
  await next();
};

// Apply admin middleware to all routes
activitiesRoute.use('*', isAdmin);

// Dashboard Statistics Routes
activitiesRoute.get('/stats/overview', getOverviewStats);
activitiesRoute.get('/stats/realtime', getRealtimeMetrics);
activitiesRoute.get('/stats/departments', getDepartmentStats);

// Cards and Activity Routes
activitiesRoute.get('/cards', getAllCardsWithProgress);
activitiesRoute.get('/recent', getRecentActivity);

// Add the new department storage route
activitiesRoute.get('/storage', getDepartmentStorage);

export { activitiesRoute };