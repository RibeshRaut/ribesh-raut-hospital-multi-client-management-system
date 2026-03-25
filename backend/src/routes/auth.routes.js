import express from 'express';
import {
  login,
  logout,
  registerWebsiteAdmin,
  registerHospitalAdmin,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';
import {
  authenticate,
  authorizeWebsiteAdmin,
} from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', authenticate, logout);
router.post('/register/website-admin', registerWebsiteAdmin);
router.post('/register/hospital-admin', registerHospitalAdmin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
