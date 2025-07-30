import { Hono } from 'hono';
import { signupController, logoutController , loginController,resendVerification,forgotPassword, verifyEmailController, verifyTokenController, getCurrentUser, getHeadUsers } from '../controllers/auth/auth_controller.js';
import { validateSignup } from '../middlewares/middleware.js';

const authRouter = new Hono()

.get('/verify-email', verifyEmailController) // Assuming you have a verifyEmailController defined
.get('/verify-token', verifyTokenController)
.get('/me', getCurrentUser) // Assuming you have a logoutController defined
.get('/heads', getHeadUsers)
.post('/signup', validateSignup, signupController)
.post('/login', loginController) // Assuming you have a loginController defined
.post('/logout', logoutController) // Assuming you have a logoutController defined
.post('/resend-verification', resendVerification)
.post('/forgot-password', forgotPassword)

// .post('/login', login);

export default authRouter;