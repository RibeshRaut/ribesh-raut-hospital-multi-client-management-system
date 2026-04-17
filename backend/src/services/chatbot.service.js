import { GoogleGenerativeAI } from '@google/generative-ai';
import Hospital from '../models/hospital.model.js';
import Doctor from '../models/doctor.model.js';
import Schedule from '../models/schedule.model.js';
import Service from '../models/service.model.js';
import Chat from '../models/chat.model.js';

let genAI;

const initializeGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};

const formatTime = (time24) => {
  if (!time24 || !time24.includes(':')) return time24;
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const buildHospitalContext = async (hospitalId) => {
  try {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return 'You are a helpful AI assistant for a hospital.';
    }

    const doctors = await Doctor.find({ hospitalId, isActive: { $ne: false } });
    const schedules = await Schedule.find({ hospitalId, status: 'active' }).populate('doctorId');
    const services = await Service.find({ hospitalId });

    let context = `You are a friendly and professional AI assistant for ${hospital.name}.`;
    context += ` Your role is to help visitors learn about the hospital, its doctors, services, and assist with appointment inquiries.`;
    context += ` Always be helpful, empathetic, and provide accurate information based on what you know about this hospital.`;
    
    context += `\n\n=== HOSPITAL INFORMATION ===`;
    context += `\nName: ${hospital.name}`;
    context += `\nAddress: ${hospital.address}`;
    context += `\nPhone: ${hospital.phone}`;
    context += `\nEmail: ${hospital.email}`;
    
    if (hospital.description) {
      context += `\nAbout: ${hospital.description}`;
    }

    if (hospital.specialties && hospital.specialties.length > 0) {
      context += `\nSpecialties: ${hospital.specialties.join(', ')}`;
    }

    if (hospital.facilities && hospital.facilities.length > 0) {
      context += `\nFacilities: ${hospital.facilities.join(', ')}`;
    }

    if (hospital.emergencyDepartment) {
      context += `\n24/7 Emergency Department: Available`;
    }

    if (hospital.totalBeds) {
      context += `\nTotal Beds: ${hospital.totalBeds}`;
    }

    // Opening Hours
    if (hospital.openingHours) {
      context += `\n\n=== OPENING HOURS ===`;
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      days.forEach(day => {
        const hours = hospital.openingHours[day];
        if (hours && !hours.isClosed) {
          context += `\n${day.charAt(0).toUpperCase() + day.slice(1)}: ${formatTime(hours.open)} - ${formatTime(hours.close)}`;
        } else if (hours?.isClosed) {
          context += `\n${day.charAt(0).toUpperCase() + day.slice(1)}: Closed`;
        }
      });
    }

    // Services
    if (services.length > 0) {
      context += `\n\n=== SERVICES OFFERED ===`;
      services.forEach((service) => {
        context += `\n- ${service.name}`;
        if (service.description) context += `: ${service.description}`;
        if (service.price) context += ` (Rs. ${service.price})`;
        if (service.duration) context += ` - Duration: ${service.duration} minutes`;
      });
    }

    // Doctors and their schedules
    if (doctors.length > 0) {
      context += `\n\n=== DOCTORS ===`;
      doctors.forEach((doc) => {
        context += `\n\nDr. ${doc.name}`;
        context += `\n  Specialty: ${doc.specialty}`;
        if (doc.qualifications) context += `\n  Qualifications: ${doc.qualifications}`;
        if (doc.experience) context += `\n  Experience: ${doc.experience} years`;
        if (doc.consultationFee) context += `\n  Consultation Fee: Rs. ${doc.consultationFee}`;
        if (doc.bio) context += `\n  About: ${doc.bio}`;
        
        // Find this doctor's schedule
        const doctorSchedule = schedules.find(s => s.doctorId?._id?.toString() === doc._id.toString());
        if (doctorSchedule) {
          context += `\n  Available Days: ${doctorSchedule.days.join(', ')}`;
          context += `\n  Hours: ${formatTime(doctorSchedule.startTime)} - ${formatTime(doctorSchedule.endTime)}`;
          context += `\n  Slot Duration: ${doctorSchedule.slotDuration} minutes`;
        }
      });
    }

    context += `\n\n=== GUIDELINES ===`;
    context += `\n- Always be polite and professional`;
    context += `\n- If asked about booking appointments, guide users to use the "Book Appointment" button on the website or contact the hospital directly`;
    context += `\n- If you don't know something specific, suggest contacting the hospital via phone or email`;
    context += `\n- Do not make up information that is not provided above`;
    context += `\n- If asked about medical advice, recommend consulting with a doctor`;
    context += `\n- Keep responses concise but helpful`;

    return context;
  } catch (error) {
    console.error('Error building hospital context:', error);
    return 'You are a helpful AI assistant for a hospital. Help users with inquiries about appointments and services.';
  }
};

export const sendMessage = async (hospitalId, sessionId, userMessage, userName = 'Guest') => {
  try {
    let chatSession = await Chat.findOne({ hospitalId, sessionId, chatType: 'ai' });

    if (!chatSession) {
      const context = await buildHospitalContext(hospitalId);
      chatSession = new Chat({
        hospitalId,
        sessionId,
        userName,
        chatType: 'ai',
        status: 'active',
        messages: [],
        context,
      });
    }

    // Update context periodically (every 10 messages)
    let context = chatSession.context;
    if (chatSession.messages.length % 10 === 0) {
      context = await buildHospitalContext(hospitalId);
      chatSession.context = context;
    }

    // Build conversation history for the AI
    // Filter out assistant messages at the start since Gemini requires 'user' first
    let historyMessages = chatSession.messages.slice(-14);
    
    // Find the first user message and start from there
    const firstUserIndex = historyMessages.findIndex(msg => msg.role === 'user');
    if (firstUserIndex > 0) {
      historyMessages = historyMessages.slice(firstUserIndex);
    } else if (firstUserIndex === -1) {
      // No user messages, start fresh
      historyMessages = [];
    }
    
    const conversationHistory = historyMessages.map((msg) => ({
      role: msg.role === 'assistant' || msg.role === 'admin' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const ai = initializeGenAI();
    const model = ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      systemInstruction: context,
    });

    const chat = model.startChat({
      history: conversationHistory,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    });

    const fullMessage = userMessage;

    let result;
    let retries = 2;
    let lastError;
    
    while (retries >= 0) {
      try {
        result = await chat.sendMessage(fullMessage);
        break;
      } catch (error) {
        lastError = error;
        if (error.status === 429 && retries > 0) {
          const backoffTime = Math.pow(2, 2 - retries) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retries--;
        } else {
          throw error;
        }
      }
    }
    
    if (!result && lastError) {
      throw lastError;
    }

    const assistantMessage = result.response.text();

    // Add user message
    chatSession.messages.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      readByAdmin: false,
      readByUser: true,
    });

    // Add assistant response
    chatSession.messages.push({
      role: 'assistant',
      content: assistantMessage,
      timestamp: new Date(),
      readByAdmin: true,
      readByUser: true,
    });

    // Keep only last 50 messages
    if (chatSession.messages.length > 50) {
      chatSession.messages = chatSession.messages.slice(-50);
    }

    chatSession.lastActivity = new Date();
    await chatSession.save();

    return {
      userMessage,
      assistantMessage,
      chatId: chatSession._id,
    };
  } catch (error) {
    console.error('Error in chatbot service:', error);
    throw error;
  }
};

export const getChatHistory = async (hospitalId, sessionId) => {
  try {
    const chatSession = await Chat.findOne({ hospitalId, sessionId });

    if (!chatSession) {
      return [];
    }

    return chatSession.messages.slice(-30).map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    }));
  } catch (error) {
    console.error('Error retrieving chat history:', error);
    throw error;
  }
};

export const clearChatHistory = async (hospitalId, sessionId) => {
  try {
    await Chat.findOneAndDelete({ hospitalId, sessionId });
    return { message: 'Chat history cleared' };
  } catch (error) {
    console.error('Error clearing chat history:', error);
    throw error;
  }
};

// Human chat functions
export const requestHumanChat = async (hospitalId, sessionId, userName, userEmail) => {
  try {
    let chatSession = await Chat.findOne({ hospitalId, sessionId });

    if (!chatSession) {
      chatSession = new Chat({
        hospitalId,
        sessionId,
        userName: userName || 'Guest',
        userEmail: userEmail || '',
        chatType: 'human',
        status: 'waiting',
        messages: [],
      });
    } else {
      chatSession.chatType = 'human';
      chatSession.status = 'waiting';
      chatSession.userName = userName || chatSession.userName;
      chatSession.userEmail = userEmail || chatSession.userEmail;
    }

    // Add system message
    chatSession.messages.push({
      role: 'assistant',
      content: 'You have requested to chat with our support team. Please wait while we connect you with an available agent.',
      timestamp: new Date(),
    });

    chatSession.lastActivity = new Date();
    await chatSession.save();

    return {
      chatId: chatSession._id,
      status: chatSession.status,
      message: 'Request submitted. Waiting for an agent.',
    };
  } catch (error) {
    console.error('Error requesting human chat:', error);
    throw error;
  }
};

export const switchToAIChat = async (hospitalId, sessionId) => {
  try {
    const chatSession = await Chat.findOne({ hospitalId, sessionId });

    if (!chatSession) {
      throw new Error('Chat session not found');
    }

    chatSession.chatType = 'ai';
    chatSession.status = 'active';
    chatSession.assignedAdmin = null;

    chatSession.messages.push({
      role: 'assistant',
      content: 'You are now chatting with our AI assistant. How can I help you?',
      timestamp: new Date(),
    });

    chatSession.lastActivity = new Date();
    await chatSession.save();

    return {
      chatId: chatSession._id,
      status: chatSession.status,
      chatType: chatSession.chatType,
    };
  } catch (error) {
    console.error('Error switching to AI chat:', error);
    throw error;
  }
};

// Get all human chats (for admin)
export const getWaitingChats = async (hospitalId) => {
  try {
    const chats = await Chat.find({
      hospitalId,
      chatType: 'human',
    }).sort({ lastActivity: -1 });

    return chats.map(chat => ({
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
      unreadCount: chat.messages.filter(m => m.role === 'user' && !m.readByAdmin).length,
      lastMessage: chat.messages[chat.messages.length - 1],
    }));
  } catch (error) {
    console.error('Error getting waiting chats:', error);
    throw error;
  }
};

// Close chat when visitor leaves the site
export const closeVisitorChatSession = async (hospitalId, sessionId) => {
  try {
    const chatSession = await Chat.findOne({
      hospitalId,
      sessionId,
      chatType: 'human',
      status: { $in: ['waiting', 'active'] },
    });

    if (!chatSession) {
      return null;
    }

    chatSession.status = 'closed';
    chatSession.lastActivity = new Date();
    chatSession.messages.push({
      role: 'assistant',
      content: 'Visitor left the site. Chat closed automatically.',
      timestamp: new Date(),
      readByAdmin: true,
      readByUser: true,
    });

    await chatSession.save();

    return chatSession;
  } catch (error) {
    console.error('Error closing visitor chat session:', error);
    throw error;
  }
};

// Admin accepts a chat
export const acceptChat = async (hospitalId, chatId, adminId) => {
  try {
    const chatSession = await Chat.findOne({ _id: chatId, hospitalId });

    if (!chatSession) {
      throw new Error('Chat not found');
    }

    chatSession.status = 'active';
    chatSession.assignedAdmin = adminId;

    chatSession.messages.push({
      role: 'admin',
      content: 'An agent has joined the chat. How can we help you today?',
      timestamp: new Date(),
      readByUser: false,
    });

    await chatSession.save();

    return chatSession;
  } catch (error) {
    console.error('Error accepting chat:', error);
    throw error;
  }
};

// Admin sends message
export const sendAdminMessage = async (hospitalId, chatId, message) => {
  try {
    const chatSession = await Chat.findOne({ _id: chatId, hospitalId });

    if (!chatSession) {
      throw new Error('Chat not found');
    }

    chatSession.messages.push({
      role: 'admin',
      content: message,
      timestamp: new Date(),
      readByUser: false,
      readByAdmin: true,
    });

    chatSession.lastActivity = new Date();
    await chatSession.save();

    return {
      message,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error sending admin message:', error);
    throw error;
  }
};

// User sends message in human chat
export const sendUserMessage = async (hospitalId, sessionId, message) => {
  try {
    const chatSession = await Chat.findOne({ hospitalId, sessionId });

    if (!chatSession) {
      throw new Error('Chat session not found');
    }

    chatSession.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
      readByAdmin: false,
      readByUser: true,
    });

    chatSession.lastActivity = new Date();
    await chatSession.save();

    return {
      chatId: chatSession._id,
      message,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('Error sending user message:', error);
    throw error;
  }
};

// Close chat
export const closeChat = async (hospitalId, chatId) => {
  try {
    const chatSession = await Chat.findOne({ _id: chatId, hospitalId });

    if (!chatSession) {
      throw new Error('Chat not found');
    }

    chatSession.status = 'closed';
    chatSession.messages.push({
      role: 'assistant',
      content: 'This chat has been closed. Thank you for contacting us!',
      timestamp: new Date(),
    });

    await chatSession.save();

    return chatSession;
  } catch (error) {
    console.error('Error closing chat:', error);
    throw error;
  }
};

// Mark messages as read
export const markMessagesAsRead = async (hospitalId, chatId, isAdmin = false) => {
  try {
    const chatSession = await Chat.findOne({ _id: chatId, hospitalId });

    if (!chatSession) {
      throw new Error('Chat not found');
    }

    chatSession.messages.forEach(msg => {
      if (isAdmin && msg.role === 'user') {
        msg.readByAdmin = true;
      } else if (!isAdmin && (msg.role === 'admin' || msg.role === 'assistant')) {
        msg.readByUser = true;
      }
    });

    await chatSession.save();

    return { success: true };
  } catch (error) {
    console.error('Error marking messages as read:', error);
    throw error;
  }
};

// Get chat by ID
export const getChatById = async (hospitalId, chatId) => {
  try {
    const chat = await Chat.findOne({ _id: chatId, hospitalId });
    return chat;
  } catch (error) {
    console.error('Error getting chat:', error);
    throw error;
  }
};

// Get chat session status
export const getChatSession = async (hospitalId, sessionId) => {
  try {
    const chat = await Chat.findOne({ hospitalId, sessionId });
    if (!chat) return null;
    
    return {
      _id: chat._id,
      chatType: chat.chatType,
      status: chat.status,
      messages: chat.messages,
      userName: chat.userName,
    };
  } catch (error) {
    console.error('Error getting chat session:', error);
    throw error;
  }
};
