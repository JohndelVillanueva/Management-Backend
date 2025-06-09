import { Hono } from 'hono';
import { signupController, logoutController , loginController,resendVerification,forgotPassword, verifyEmailController, verifyTokenController } from '../controllers/auth/auth_controller.js';
import { validateSignup } from '../middlewares/middleware.js';

const authRouter = new Hono();

authRouter.get('/verify-email', verifyEmailController); // Assuming you have a verifyEmailController defined
authRouter.get('/verify-token', verifyTokenController);
authRouter.post('/signup', validateSignup, signupController);
authRouter.post('/login', loginController); // Assuming you have a loginController defined
authRouter.post('/logout', logoutController); // Assuming you have a logoutController defined
authRouter.post('/resend-verification', resendVerification);
authRouter.post('/forgot-password', forgotPassword);

// authRouter.post('/login', login);

export default authRouter;