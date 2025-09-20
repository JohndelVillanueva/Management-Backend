import { Hono } from 'hono';
import { getAllUsers, testConnection } from '../controllers/users/usersController.js';
import { authMiddleware } from '../middlewares/authmiddleware.js';

const usersRoute = new Hono()

.get('/', authMiddleware, getAllUsers)
.get('/test', testConnection);

export default usersRoute;