import { Router } from 'express';
import { checkPhone, signup, login, resetPassword } from '../controllers/authController';
import { requestOtp, confirmOtp } from '../controllers/otpController';
import { validateBody } from '../middleware/validate';
import { checkPhoneSchema, signupSchema, loginSchema, sendOtpSchema, verifyOtpSchema, resetPasswordSchema } from '../validators/schemas';

const router = Router();

// Public routes - no authentication required
router.post('/check-phone', validateBody(checkPhoneSchema), checkPhone);
router.post('/signup', validateBody(signupSchema), signup);
router.post('/login', validateBody(loginSchema), login);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

// OTP routes
router.post('/otp/send', validateBody(sendOtpSchema), requestOtp);
router.post('/otp/verify', validateBody(verifyOtpSchema), confirmOtp);

export default router;
