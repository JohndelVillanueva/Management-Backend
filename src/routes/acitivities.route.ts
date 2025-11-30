// src/routes/activities.route.ts
import { Hono } from 'hono';
import { 
  getActivityOverview,
  getRealtimeStats,
  getDepartmentActivityStats,
  getRecentActivity
} from '../controllers/activities/ActivityStatsController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const activitiesRoute = new Hono();

// Register all routes
activitiesRoute
  .get('/stats/overview', authMiddleware, getActivityOverview)
  .get('/stats/realtime', authMiddleware, getRealtimeStats)
  .get('/stats/departments', authMiddleware, getDepartmentActivityStats)
  .get('/recent', authMiddleware, getRecentActivity); // This should handle /activities/recent

export default activitiesRoute;