"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageCircle,
  Send,
  User,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  MessageSquare,
  Users,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant" | "admin";
  content: string;
  timestamp: Date | string;
  readByAdmin?: boolean;
}

interface ChatSession {
  _id: string;
  sessionId: string;
  hospitalId: string;
  chatType: "ai" | "human";
  status: "active" | "waiting" | "closed";
  userName?: string;
  userEmail?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
  lastActivity?: string;
  unreadCount?: number;
  lastMessage?: Message;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" ? (value as UnknownRecord) : {};

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string | number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: unknown) => {
  const date = toValidDate(value);
  if (!date) return "—";
  return date.toLocaleString();
};

const formatTime = (value: unknown) => {
  const date = toValidDate(value);
  if (!date) return "--:--";
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeMessage = (message: unknown): Message => {
  const msg = asRecord(message);
  const role = msg.role === "user" || msg.role === "assistant" || msg.role === "admin" ? msg.role : "assistant";

  return {
    role,
    content: typeof msg.content === "string" ? msg.content : "",
    timestamp: toValidDate(msg.timestamp) || new Date(),
    readByAdmin: typeof msg.readByAdmin === "boolean" ? msg.readByAdmin : undefined,
  };
};

const normalizeChat = (chat: unknown): ChatSession => {
  const source = asRecord(chat);
  const normalizedId =
    (typeof source._id === "string" && source._id) ||
    (typeof source.chatId === "string" && source.chatId) ||
    (typeof source.sessionId === "string" && `session:${source.sessionId}`) ||
    `chat:${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const sourceMessages = Array.isArray(source.messages) ? source.messages : [];
  const normalizedMessages = sourceMessages
    ? sourceMessages.map((message) => normalizeMessage(message))
    : [];

  const normalizedLastMessage = source.lastMessage
    ? normalizeMessage(source.lastMessage)
    : normalizedMessages.length > 0
    ? normalizedMessages[normalizedMessages.length - 1]
    : undefined;

  const updatedAt =
    (typeof source.updatedAt === "string" && source.updatedAt) ||
    (typeof source.lastActivity === "string" && source.lastActivity) ||
    (typeof source.createdAt === "string" && source.createdAt) ||
    new Date().toISOString();
  const createdAt =
    (typeof source.createdAt === "string" && source.createdAt) ||
    (typeof source.lastActivity === "string" && source.lastActivity) ||
    updatedAt;

  return {
    ...(source as unknown as ChatSession),
    _id: normalizedId,
    messages: normalizedMessages,
    lastMessage: normalizedLastMessage,
    createdAt,
    updatedAt,
    lastActivity: (typeof source.lastActivity === "string" && source.lastActivity) || updatedAt,
  };
};

export default function ChatsPage() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [filter, setFilter] = useState<"all" | "waiting" | "active" | "closed">("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get auth token
  const getToken = () => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("token");
    }
    return null;
  };

  // Get hospital ID from localStorage
  const getHospitalId = () => {
    if (typeof window !== "undefined") {
      // Try multiple storage locations
      const userInfoStr = localStorage.getItem("userInfo");
      if (userInfoStr) {
        try {
          const userInfo = JSON.parse(userInfoStr);
          return userInfo.hospitalId || userInfo.id || userInfo._id;
        } catch (e) {}
      }
      const adminStr = localStorage.getItem("admin");
      if (adminStr) {
        try {
          const admin = JSON.parse(adminStr);
          return admin.hospitalId;
        } catch (e) {}
      }
    }
    return null;
  };

  // Initialize Socket.IO
  useEffect(() => {
    const token = getToken();
    const hospitalId = getHospitalId();
    if (!token || !hospitalId) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3002", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socketInstance.on("connect", () => {
      console.log("Admin socket connected");
      socketInstance.emit("admin:join", { hospitalId, adminId: token });
    });

    socketInstance.on("chat:newChat", ({ chat }) => {
      const normalizedChat = normalizeChat(chat);
      setChats((prev) => {
        const exists = prev.find((c) => c._id === normalizedChat._id);
        if (exists) return prev;
        return [normalizedChat, ...prev];
      });
    });

    socketInstance.on("chat:newWaiting", (payload) => {
      const payloadRecord = asRecord(payload);
      const incomingChat = payloadRecord.chat ?? payload;
      const normalizedChat = normalizeChat(incomingChat);

      setChats((prev) => {
        const exists = prev.find((chat) => chat._id === normalizedChat._id);
        if (exists) {
          return prev.map((chat) =>
            chat._id === normalizedChat._id
              ? {
                  ...chat,
                  ...normalizedChat,
                  messages:
                    normalizedChat.messages.length > 0
                      ? normalizedChat.messages
                      : chat.messages,
                }
              : chat
          );
        }

        return [normalizedChat, ...prev];
      });

      setSelectedChat((prev) =>
        prev && prev._id === normalizedChat._id
          ? {
              ...prev,
              ...normalizedChat,
              messages:
                normalizedChat.messages.length > 0
                  ? normalizedChat.messages
                  : prev.messages,
            }
          : prev
      );
    });

    socketInstance.on("chat:newMessage", ({ chatId, message }) => {
      const normalizedMessage = normalizeMessage(message);
      setChats((prev) =>
        prev.map((chat) =>
          chat._id === chatId
            ? {
                ...chat,
                messages: [...(chat.messages || []), normalizedMessage],
                updatedAt: new Date().toISOString(),
              }
            : chat
        )
      );

      setSelectedChat((prev) =>
        prev && prev._id === chatId
          ? {
              ...prev,
              messages: [...(prev.messages || []), normalizedMessage],
            }
          : prev
      );
    });

    socketInstance.on("chat:userTyping", ({ chatId }) => {
      if (selectedChat?._id === chatId) {
        setIsUserTyping(true);
        setTimeout(() => setIsUserTyping(false), 2000);
      }
    });

    const handleWaitingChats = (payload: unknown) => {
      const payloadRecord = asRecord(payload);
      const waitingChats = Array.isArray(payload)
        ? payload
        : Array.isArray(payloadRecord.chats)
        ? payloadRecord.chats
        : [];

      const normalizedWaitingChats = waitingChats.map((incomingChat) =>
        normalizeChat(incomingChat)
      );

      setSelectedChat((prev) => {
        if (!prev) return prev;

        const updatedSelectedChat = normalizedWaitingChats.find(
          (chat) => chat._id === prev._id
        );

        if (!updatedSelectedChat) return prev;

        return {
          ...prev,
          ...updatedSelectedChat,
          messages:
            updatedSelectedChat.messages.length > 0
              ? updatedSelectedChat.messages
              : prev.messages,
        };
      });

      setChats((prev) => {
        const chatMap = new Map(prev.map((chat) => [chat._id, chat]));

        normalizedWaitingChats.forEach((normalizedChat) => {
          const existing = chatMap.get(normalizedChat._id);
          chatMap.set(normalizedChat._id, {
            ...(existing || normalizedChat),
            ...normalizedChat,
            messages:
              normalizedChat.messages.length > 0
                ? normalizedChat.messages
                : existing?.messages || [],
          });
        });

        return Array.from(chatMap.values()).sort(
          (a, b) =>
            (toValidDate(b.updatedAt || b.lastActivity)?.getTime() || 0) -
            (toValidDate(a.updatedAt || a.lastActivity)?.getTime() || 0)
        );
      });
    };

    socketInstance.on("chat:waitingList", handleWaitingChats);
    socketInstance.on("admin:waitingChats", handleWaitingChats);

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  // Fetch chats
  const fetchChats = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (data.success) {
        setChats((Array.isArray(data.chats) ? data.chats : []).map((chat) => normalizeChat(chat)));
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Auto scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedChat?.messages]);

  // Accept chat
  const acceptChat = async (chatId: string) => {
    const token = getToken();
    if (!token) {
      console.error("No auth token found");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats/${chatId}/accept`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      console.log("Accept chat response:", data);

      if (data.success) {
        // Update local state
        setChats((prev) =>
          prev.map((chat) =>
            chat._id === chatId ? { ...chat, status: "active", messages: data.chat?.messages || chat.messages } : chat
          )
        );
        if (selectedChat?._id === chatId) {
          setSelectedChat((prev) => (prev ? { ...prev, status: "active", messages: data.chat?.messages || prev.messages } : null));
        }

        // Emit socket event if connected
        if (socket) {
          socket.emit("admin:accept", { chatId });
        }
      } else {
        console.error("Failed to accept chat:", data.error);
      }
    } catch (error) {
      console.error("Error accepting chat:", error);
    }
  };

  // Close chat
  const closeChat = async (chatId: string) => {
    const token = getToken();
    if (!token) {
      console.error("No auth token found");
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats/${chatId}/close`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();

      if (data.success) {
        // Update local state
        setChats((prev) =>
          prev.map((chat) =>
            chat._id === chatId ? { ...chat, status: "closed" } : chat
          )
        );
        if (selectedChat?._id === chatId) {
          setSelectedChat((prev) => (prev ? { ...prev, status: "closed" } : null));
        }

        // Emit socket event if connected
        if (socket) {
          socket.emit("admin:close", { chatId });
        }
      }
    } catch (error) {
      console.error("Error closing chat:", error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedChat || isSending) return;

    const token = getToken();
    if (!token) {
      console.error("No auth token found");
      return;
    }

    const message = inputValue.trim();
    setInputValue("");
    setIsSending(true);

    // Add message locally immediately
    const newMessage: Message = {
      role: "admin",
      content: message,
      timestamp: new Date(),
    };

    setSelectedChat((prev) =>
      prev
        ? {
            ...prev,
            messages: [...(prev.messages || []), newMessage],
          }
        : null
    );

    setChats((prev) =>
      prev.map((chat) =>
        chat._id === selectedChat._id
          ? {
              ...chat,
              messages: [...(chat.messages || []), newMessage],
              updatedAt: new Date().toISOString(),
            }
          : chat
      )
    );

    try {
      // Send via API
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats/${selectedChat._id}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ message }),
        }
      );

      // Emit via socket if connected
      if (socket) {
        socket.emit("admin:message", {
          chatId: selectedChat._id,
          sessionId: selectedChat.sessionId,
          message,
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Mark messages as read
  const markAsRead = async (chatId: string) => {
    const token = getToken();
    if (!token) return;

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/admin/chats/${chatId}/mark-read`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  // Select chat
  const handleSelectChat = (chat: ChatSession) => {
    setSelectedChat(chat);
    markAsRead(chat._id);
  };

  // Filter chats
  const filteredChats = chats.filter((chat) => {
    if (filter === "all") return true;
    return chat.status === filter;
  });

  // Count by status
  const waitingCount = chats.filter((c) => c.status === "waiting").length;
  const activeCount = chats.filter((c) => c.status === "active").length;
  const closedCount = chats.filter((c) => c.status === "closed").length;

  // Get unread count for a chat
  const getUnreadCount = (chat: ChatSession) => {
    if (!chat.messages || !Array.isArray(chat.messages)) return 0;
    return chat.messages.filter(
      (m) => m.role === "user" && !m.readByAdmin
    ).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Live Chat Support</h1>
          <p className="text-muted-foreground">
            Manage and respond to customer inquiries
          </p>
        </div>
        <div className="flex items-center gap-4">
          {waitingCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {waitingCount} waiting
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-[calc(100%-5rem)]">
        {/* Chat List */}
        <div className="col-span-4 border rounded-lg overflow-hidden flex flex-col">
          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b px-2">
              <TabsTrigger
                value="all"
                onClick={() => setFilter("all")}
                className="text-xs"
              >
                All ({chats.length})
              </TabsTrigger>
              <TabsTrigger
                value="waiting"
                onClick={() => setFilter("waiting")}
                className="text-xs"
              >
                Waiting ({waitingCount})
              </TabsTrigger>
              <TabsTrigger
                value="active"
                onClick={() => setFilter("active")}
                className="text-xs"
              >
                Active ({activeCount})
              </TabsTrigger>
              <TabsTrigger
                value="closed"
                onClick={() => setFilter("closed")}
                className="text-xs"
              >
                Closed ({closedCount})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1">
              <div className="divide-y">
                {filteredChats.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No chats found</p>
                  </div>
                ) : (
                  filteredChats.map((chat) => {
                    const unreadCount = getUnreadCount(chat);
                    const messages = chat.messages || [];
                    const lastMessage = chat.lastMessage || (messages.length > 0 ? messages[messages.length - 1] : null);

                    return (
                      <button
                        key={chat._id}
                        onClick={() => handleSelectChat(chat)}
                        className={cn(
                          "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                          selectedChat?._id === chat._id && "bg-muted"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback
                              className={cn(
                                chat.status === "waiting"
                                  ? "bg-amber-100 text-amber-700"
                                  : chat.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-gray-100 text-gray-500"
                              )}
                            >
                              <User className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">
                                {chat.userName || "Anonymous"}
                              </span>
                              <div className="flex items-center gap-1">
                                {unreadCount > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                                  >
                                    {unreadCount}
                                  </Badge>
                                )}
                                <Badge
                                  variant={
                                    chat.status === "waiting"
                                      ? "outline"
                                      : chat.status === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className={cn(
                                    "text-[10px]",
                                    chat.status === "waiting" &&
                                      "border-amber-500 text-amber-600 animate-pulse"
                                  )}
                                >
                                  {chat.status}
                                </Badge>
                              </div>
                            </div>
                            {lastMessage && (
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {lastMessage.role === "user"
                                  ? lastMessage.content
                                  : `You: ${lastMessage.content}`}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateTime(chat.updatedAt || chat.lastActivity || lastMessage?.timestamp)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </div>

        {/* Chat Window */}
        <div className="col-span-8 border rounded-lg overflow-hidden flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback
                      className={cn(
                        selectedChat.status === "waiting"
                          ? "bg-amber-100 text-amber-700"
                          : selectedChat.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {selectedChat.userName || "Anonymous"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedChat.userEmail || "No email provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedChat.status === "waiting" && (
                    <Button
                      size="sm"
                      onClick={() => acceptChat(selectedChat._id)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept Chat
                    </Button>
                  )}
                  {selectedChat.status === "active" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => closeChat(selectedChat._id)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Close Chat
                    </Button>
                  )}
                  <Badge
                    variant={
                      selectedChat.status === "waiting"
                        ? "outline"
                        : selectedChat.status === "active"
                        ? "default"
                        : "secondary"
                    }
                    className={
                      selectedChat.status === "waiting"
                        ? "border-amber-500 text-amber-600"
                        : ""
                    }
                  >
                    {selectedChat.status}
                  </Badge>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {(selectedChat.messages || []).map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-2",
                        message.role === "admin"
                          ? "justify-end"
                          : "justify-start"
                      )}
                    >
                      {message.role !== "admin" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback
                            className={cn(
                              message.role === "assistant"
                                ? "bg-primary/10 text-primary"
                                : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {message.role === "assistant" ? (
                              <Bot className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                          message.role === "admin"
                            ? "bg-primary text-white rounded-br-md"
                            : message.role === "assistant"
                            ? "bg-primary/10 text-foreground rounded-bl-md"
                            : "bg-blue-100 text-blue-900 rounded-bl-md"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            message.role === "admin"
                              ? "text-white/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* User typing indicator */}
                  {isUserTyping && (
                    <div className="flex gap-2 justify-start">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-blue-100 text-blue-700">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-blue-100 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                          <span
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          />
                          <span
                            className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              {selectedChat.status === "active" && (
                <div className="p-4 border-t">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type your message..."
                      disabled={isSending}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={!inputValue.trim() || isSending}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </form>
                </div>
              )}

              {selectedChat.status === "waiting" && (
                <div className="p-4 border-t bg-amber-50 text-center">
                  <p className="text-sm text-amber-700">
                    Accept this chat to start responding to the customer
                  </p>
                </div>
              )}

              {selectedChat.status === "closed" && (
                <div className="p-4 border-t bg-muted text-center">
                  <p className="text-sm text-muted-foreground">
                    This chat has been closed
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <h3 className="font-medium">Select a chat</h3>
                <p className="text-sm">
                  Choose a conversation from the list to start chatting
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
