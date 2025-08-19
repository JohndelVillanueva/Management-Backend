import { Hono } from 'hono';
import { getAllUsers } from '../controllers/users/usersController.js';

const usersRoute = new Hono()

.get('/', getAllUsers);

export default usersRoute;