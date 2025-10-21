// user.route.ts - Fixed version
import { Hono } from 'hono';
import { getAllUsers, testConnection, updateUser } from '../controllers/users/usersController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const usersRoute = new Hono();

// Make sure these routes are properly defined
usersRoute
  .get('/', authMiddleware, getAllUsers)
  .get('/test', testConnection)
  .put('/:id', authMiddleware, updateUser); // ✅ Fixed: chain the methods properly

export default usersRoute;