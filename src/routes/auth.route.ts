import { Hono } from 'hono';
import { signupController, logoutController , loginController,resendVerification,forgotPassword } from '../controllers/auth/auth_controller.js';
import { validateSignup } from '../middlewares/middleware.js';

const authRouter = new Hono();

authRouter.post('/signup', validateSignup, signupController);
authRouter.post('/login', loginController); // Assuming you have a loginController defined
authRouter.post('/logout', logoutController); // Assuming you have a logoutController defined
authRouter.post('/resend-verification', resendVerification);
authRouter.post('/forgot-password', forgotPassword);
// authRouter.post('/login', login);

export default authRouter;