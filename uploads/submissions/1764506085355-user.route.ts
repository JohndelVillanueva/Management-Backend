// user.route.ts - Fixed version
import { Hono } from 'hono';
import { getAllUsers, getUserById, testConnection, updateUser, uploadAvatar } from '../controllers/users/usersController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const usersRoute = new Hono();

// Make sure these routes are properly defined
usersRoute
  .get('/', authMiddleware, getAllUsers)
  .get('/test', testConnection)
  .get('/:id', authMiddleware, getUserById)
  .put('/:id', authMiddleware, updateUser) 
  .post('/:id/avatar', authMiddleware, uploadAvatar); 

export default usersRoute;