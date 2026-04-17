import {
  sendMessage,
  getChatHistory,
  clearChatHistory,
  requestHumanChat,
  switchToAIChat,
  getWaitingChats,
  acceptChat,
  sendAdminMessage,
  sendUserMessage,
  closeChat,
  closeVisitorChatSession,
  markMessagesAsRead,
  getChatById,
  getChatSession,
} from '../services/chatbot.service.js';

const requestCounts = new Map();
const responseCache = new Map();
const RATE_LIMIT = 10; // 10 messages per window
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const CACHE_DURATION = 300000; // 5 minutes

const getCacheKey = (hospitalId, message) => {
  return `${hospitalId}:${message.toLowerCase().trim()}`;
};

const getCachedResponse = (cacheKey) => {
  const cached = responseCache.get(cacheKey);
  if (!cached) return null;

  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    responseCache.delete(cacheKey);
    return null;
  }

  return cached.response;
};

const setCachedResponse = (cacheKey, response) => {
  responseCache.set(cacheKey, {
    response,
    timestamp: Date.now(),
  });
};

const checkRateLimit = (sessionId) => {
  const now = Date.now();
  const key = `${sessionId}-${Math.floor(now / RATE_LIMIT_WINDOW)}`;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, 1);
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  const count = requestCounts.get(key);
  if (count >= RATE_LIMIT) {
    const resetTime = Math.ceil((RATE_LIMIT_WINDOW - (now % RATE_LIMIT_WINDOW)) / 1000);
    return { allowed: false, resetTime };
  }

  requestCounts.set(key, count + 1);
  return { allowed: true, remaining: RATE_LIMIT - count - 1 };
};

// AI Chat endpoint
export const chat = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { message, sessionId, userName } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const trimmedMessage = message.trim();
    const cacheKey = getCacheKey(hospitalId, trimmedMessage);

    // Check cache for identical questions
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      return res.status(200).json({
        success: true,
        message: cachedResponse,
        cached: true,
      });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(sessionId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Please try again in ${rateLimit.resetTime} seconds.`,
        resetTime: rateLimit.resetTime,
      });
    }

    const result = await sendMessage(hospitalId, sessionId, trimmedMessage, userName);

    // Cache the response
    setCachedResponse(cacheKey, result.assistantMessage);

    res.status(200).json({
      success: true,
      message: result.assistantMessage,
      chatId: result.chatId,
      cached: false,
    });
  } catch (error) {
    console.error('Error in chat controller:', error);
    if (error.status === 429) {
      return res.status(429).json({ error: 'API rate limit exceeded. Please try again in a few minutes.' });
    }
    res.status(500).json({ error: 'Failed to process message' });
  }
};

// Get chat history
export const getHistory = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const history = await getChatHistory(hospitalId, sessionId);

    res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
};

// Clear chat history
export const clearHistory = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    await clearChatHistory(hospitalId, sessionId);

    res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history' });
  }
};

// Get chat session status
export const getSession = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const session = await getChatSession(hospitalId, sessionId);

    res.status(200).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
};

// Request human chat
export const requestHuman = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId, userName, userEmail } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const result = await requestHumanChat(hospitalId, sessionId, userName, userEmail);

    const io = req.app.get('io');
    if (io && result?.chatId) {
      const chat = await getChatById(hospitalId, result.chatId);
      const chats = await getWaitingChats(hospitalId);

      if (chat) {
        io.to(`admin:${hospitalId}`).emit('chat:newWaiting', {
          chat: {
            _id: chat._id,
            sessionId: chat.sessionId,
            hospitalId: chat.hospitalId,
            chatType: chat.chatType,
            userName: chat.userName,
            userEmail: chat.userEmail,
            status: chat.status,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            lastActivity: chat.lastActivity,
            messages: chat.messages,
            unreadCount: chat.messages.filter((m) => m.role === 'user' && !m.readByAdmin).length,
            lastMessage: chat.messages[chat.messages.length - 1],
          },
        });
      }

      io.to(`admin:${hospitalId}`).emit('chat:waitingList', chats);
    }

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error requesting human chat:', error);
    res.status(500).json({ error: 'Failed to request human chat' });
  }
};

// Switch back to AI chat
export const switchToAI = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const result = await switchToAIChat(hospitalId, sessionId);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error switching to AI chat:', error);
    res.status(500).json({ error: 'Failed to switch to AI chat' });
  }
};

// Send user message in human chat
export const sendUserMsg = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({ error: 'Session ID and message are required' });
    }

    const result = await sendUserMessage(hospitalId, sessionId, message);

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error sending user message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Mark visitor chat as closed when browser/site is closed
export const visitorLeft = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const chat = await closeVisitorChatSession(hospitalId, sessionId);

    const io = req.app.get('io');
    if (io && chat) {
      notifyAdminChats(io, hospitalId);
    }

    res.status(200).json({
      success: true,
      status: chat?.status || 'closed',
    });
  } catch (error) {
    console.error('Error marking visitor chat as closed:', error);
    res.status(500).json({ error: 'Failed to update visitor chat status' });
  }
};

// ============ ADMIN ENDPOINTS ============

// Get waiting/active chats for admin
export const getAdminChats = async (req, res) => {
  try {
    const hospitalId = req.user.hospitalId || req.user.id;

    const chats = await getWaitingChats(hospitalId);

    res.status(200).json({
      success: true,
      chats,
    });
  } catch (error) {
    console.error('Error getting admin chats:', error);
    res.status(500).json({ error: 'Failed to get chats' });
  }
};

// Get specific chat details for admin
export const getAdminChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const hospitalId = req.user.hospitalId || req.user.id;

    const chat = await getChatById(hospitalId, chatId);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    res.status(200).json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error getting chat:', error);
    res.status(500).json({ error: 'Failed to get chat' });
  }
};

// Admin accepts a chat
export const adminAcceptChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const hospitalId = req.user.hospitalId || req.user.id;
    const adminId = req.user.id;

    const chat = await acceptChat(hospitalId, chatId, adminId);

    // Emit socket events to notify the user
    const io = req.app.get('io');
    if (io && chat) {
      // Notify user that admin joined
      io.to(`session:${chat.sessionId}`).emit('chat:adminJoined', {
        chatId: chat._id,
      });

      // Send the join message
      io.to(`session:${chat.sessionId}`).emit('chat:newMessage', {
        chatId: chat._id,
        message: {
          role: 'admin',
          content: 'An agent has joined the chat. How can we help you today?',
          timestamp: new Date(),
        },
      });
    }

    res.status(200).json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error accepting chat:', error);
    res.status(500).json({ error: 'Failed to accept chat' });
  }
};

// Admin sends message
export const adminSendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { message } = req.body;
    const hospitalId = req.user.hospitalId || req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await sendAdminMessage(hospitalId, chatId, message);

    // Emit socket event to notify user
    const io = req.app.get('io');
    if (io && result.chat) {
      io.to(`session:${result.chat.sessionId}`).emit('chat:newMessage', {
        chatId: result.chat._id,
        message: {
          role: 'admin',
          content: message,
          timestamp: new Date(),
        },
      });
    }

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Admin closes chat
export const adminCloseChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const hospitalId = req.user.hospitalId || req.user.id;

    const chat = await closeChat(hospitalId, chatId);

    // Emit socket event to notify user
    const io = req.app.get('io');
    if (io && chat) {
      io.to(`session:${chat.sessionId}`).emit('chat:closed', {
        chatId: chat._id,
      });
    }

    res.status(200).json({
      success: true,
      chat,
    });
  } catch (error) {
    console.error('Error closing chat:', error);
    res.status(500).json({ error: 'Failed to close chat' });
  }
};

// Mark messages as read (admin)
export const adminMarkRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const hospitalId = req.user.hospitalId || req.user.id;

    await markMessagesAsRead(hospitalId, chatId, true);

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

const notifyAdminChats = async (io, hospitalId) => {
  try {
    const chats = await getWaitingChats(hospitalId);
    io.to(`admin:${hospitalId}`).emit('chat:waitingList', chats);
  } catch (error) {
    console.error('Error notifying admin chats:', error);
  }
};
