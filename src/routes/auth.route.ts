import { Hono } from 'hono';
import { signup } from '../controllers/auth/auth_controller.js';
import { validateSignup } from '../middlewares/middleware.js';

const authRouter = new Hono();

authRouter.post('/signup', validateSignup, signup);
// authRouter.post('/login', login);

export default authRouter;