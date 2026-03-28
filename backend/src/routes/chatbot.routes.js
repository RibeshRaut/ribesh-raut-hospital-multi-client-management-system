import express from 'express';
import {
  chat,
  getHistory,
  clearHistory,
  getSession,
  requestHuman,
  switchToAI,
  sendUserMsg,
  getAdminChats,
  getAdminChatById,
  adminAcceptChat,
  adminSendMessage,
  adminCloseChat,
  adminMarkRead,
} from '../controllers/chatbot.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  requireHospitalSubscription,
  requireSubscriptionByHospitalParam,
} from '../middlewares/subscription.middleware.js';

const router = express.Router();

// Public chat endpoints (for hospital visitors)
router.post('/:hospitalId/message', requireSubscriptionByHospitalParam, chat);
router.get('/:hospitalId/history', requireSubscriptionByHospitalParam, getHistory);
router.delete('/:hospitalId/history', requireSubscriptionByHospitalParam, clearHistory);
router.get('/:hospitalId/session', requireSubscriptionByHospitalParam, getSession);
router.post('/:hospitalId/request-human', requireSubscriptionByHospitalParam, requestHuman);
router.post('/:hospitalId/switch-to-ai', requireSubscriptionByHospitalParam, switchToAI);
router.post('/:hospitalId/user-message', requireSubscriptionByHospitalParam, sendUserMsg);

// Admin chat endpoints (requires authentication)
router.get('/admin/chats', authenticate, requireHospitalSubscription, getAdminChats);
router.get('/admin/chats/:chatId', authenticate, requireHospitalSubscription, getAdminChatById);
router.post('/admin/chats/:chatId/accept', authenticate, requireHospitalSubscription, adminAcceptChat);
router.post('/admin/chats/:chatId/message', authenticate, requireHospitalSubscription, adminSendMessage);
router.post('/admin/chats/:chatId/close', authenticate, requireHospitalSubscription, adminCloseChat);
router.post('/admin/chats/:chatId/mark-read', authenticate, requireHospitalSubscription, adminMarkRead);

export default router;
