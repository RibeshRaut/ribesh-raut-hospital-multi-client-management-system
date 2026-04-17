"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Minimize2,
  Loader2,
  UserCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant" | "admin";
  content: string;
  timestamp: Date;
}

interface ChatWidgetProps {
  hospitalId: string;
  hospitalName: string;
}

interface SessionMessagePayload {
  role: Message["role"];
  content: string;
  timestamp: string | number | Date;
}

type ChatMode = "selection" | "ai" | "human";

export function ChatWidget({ hospitalId, hospitalName }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("selection");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createSessionId = () =>
    `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  // Generate a fresh session ID on each page load
  useEffect(() => {
    setSessionId(createSessionId());
  }, [hospitalId]);

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!sessionId || chatMode !== "human") return;

    const socketInstance = io(process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:3002", {
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected");
      socketInstance.emit("user:join", { hospitalId, sessionId });
    });

    socketInstance.on("chat:newMessage", ({ message }) => {
      setMessages((prev) => [
        ...prev,
        {
          role: message.role,
          content: message.content,
          timestamp: new Date(message.timestamp),
        },
      ]);
    });

    socketInstance.on("chat:adminJoined", () => {
      setIsWaiting(false);
    });

    socketInstance.on("chat:closed", () => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "This chat has been closed. Thank you for contacting us!",
          timestamp: new Date(),
        },
      ]);
    });

    socketInstance.on("chat:adminTyping", () => {
      setIsAdminTyping(true);
      setTimeout(() => setIsAdminTyping(false), 2000);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [sessionId, chatMode, hospitalId]);

  useEffect(() => {
    if (chatMode !== "human" || !sessionId) return;

    const handlePageUnload = () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api";
      const endpoint = `${apiUrl}/chatbot/${hospitalId}/visitor-left`;
      const payload = JSON.stringify({ sessionId });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(endpoint, blob);
      } else {
        fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handlePageUnload);

    return () => {
      window.removeEventListener("beforeunload", handlePageUnload);
    };
  }, [chatMode, hospitalId, sessionId]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Load session status
  const loadSessionStatus = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/${hospitalId}/session?sessionId=${sessionId}`
      );
      const data = await response.json();

      if (data.success && data.session) {
        if (data.session.chatType === "human") {
          setChatMode("human");
          setIsWaiting(data.session.status === "waiting");
        } else if (data.session.chatType === "ai") {
          setChatMode("ai");
        }
        if (data.session.messages) {
          const parsedMessages = data.session.messages as SessionMessagePayload[];
          setMessages(
            parsedMessages.map((msg) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            }))
          );
        }
      }
    } catch (error) {
      console.error("Error loading session:", error);
    }
  }, [hospitalId, sessionId]);

  useEffect(() => {
    if (isOpen && sessionId) {
      loadSessionStatus();
    }
  }, [isOpen, sessionId, loadSessionStatus]);

  // Send message to AI
  const sendAIMessage = async (message: string) => {
    setIsLoading(true);

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date() },
    ]);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/${hospitalId}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, sessionId, userName: userName || "Guest" }),
        }
      );

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message, timestamp: new Date() },
        ]);
      } else {
        throw new Error(data.error || "Failed to get response");
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: errorMessage.includes("Rate limit")
            ? "You're sending messages too quickly. Please wait a moment and try again."
            : "Sorry, I'm having trouble responding right now. Please try again later.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Send message to human support
  const sendHumanMessage = async (message: string) => {
    if (!socket) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: message, timestamp: new Date() },
    ]);

    // Emit through socket
    socket.emit("user:message", {
      hospitalId,
      sessionId,
      message,
      chatType: "human",
    });

    // Also send via API for persistence
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/${hospitalId}/user-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message }),
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue.trim();
    setInputValue("");

    if (chatMode === "ai") {
      sendAIMessage(message);
    } else if (chatMode === "human") {
      sendHumanMessage(message);
    }
  };

  // Request human support
  const requestHumanSupport = async () => {
    if (!sessionId) return;

    if (!userName.trim()) {
      setShowUserForm(true);
      return;
    }

    setShowUserForm(false);
    setChatMode("human");
    setIsWaiting(true);

    // Add system message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Connecting you with our support team. Please wait...",
        timestamp: new Date(),
      },
    ]);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/${hospitalId}/request-human`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, userName, userEmail }),
        }
      );

      // Also emit via socket for real-time notification
      if (socket) {
        socket.emit("user:requestHuman", { hospitalId, sessionId, userName, userEmail });
      }
    } catch (error) {
      console.error("Error requesting human support:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Unable to connect to support. Please try again later.",
          timestamp: new Date(),
        },
      ]);
      setIsWaiting(false);
    }
  };

  // Switch to AI chat
  const switchToAI = async () => {
    setChatMode("ai");
    setIsWaiting(false);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "You are now chatting with our AI assistant. How can I help you?",
        timestamp: new Date(),
      },
    ]);

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002/api"}/chatbot/${hospitalId}/switch-to-ai`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        }
      );
    } catch (error) {
      console.error("Error switching to AI:", error);
    }
  };

  // Start AI chat
  const startAIChat = () => {
    setChatMode("ai");
    setMessages([
      {
        role: "assistant",
        content: `Hello! 👋 I'm the AI assistant for ${hospitalName}. How can I help you today? I can answer questions about our doctors, services, appointments, and more.`,
        timestamp: new Date(),
      },
    ]);
  };

  // Start human chat
  const startHumanChat = () => {
    if (!userName.trim()) {
      setShowUserForm(true);
    } else {
      requestHumanSupport();
    }
  };

  // Handle user form submit
  const handleUserFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      requestHumanSupport();
    }
  };

  // Reset to selection
  const backToSelection = () => {
    setChatMode("selection");
    setShowUserForm(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all duration-300 flex items-center justify-center group hover:scale-110"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 pb-10 bg-white rounded-2xl shadow-2xl border transition-all duration-300 overflow-hidden",
        isMinimized ? "w-72 h-14" : "w-96 h-[550px]"
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {chatMode !== "selection" && (
            <button
              onClick={backToSelection}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            {chatMode === "ai" ? (
              <Bot className="h-5 w-5" />
            ) : chatMode === "human" ? (
              <UserCircle className="h-5 w-5" />
            ) : (
              <MessageCircle className="h-5 w-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm">
              {chatMode === "ai"
                ? "AI Assistant"
                : chatMode === "human"
                ? "Live Support"
                : hospitalName}
            </h3>
            <p className="text-xs text-white/80">
              {chatMode === "ai"
                ? "Powered by AI"
                : chatMode === "human"
                ? isWaiting
                  ? "Waiting for agent..."
                  : "Connected"
                : "How can we help?"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Selection Screen */}
          {chatMode === "selection" && !showUserForm && (
            <div className="p-6 flex flex-col items-center justify-center h-[calc(100%-72px)]">
              <div className="text-center mb-8">
                <h3 className="text-lg font-semibold mb-2">Welcome! 👋</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how you&apos;d like to get help today
                </p>
              </div>

              <div className="w-full space-y-4">
                <button
                  onClick={startAIChat}
                  className="w-full p-4 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Sparkles className="h-6 w-6 text-primary group-hover:text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold">Chat with AI</h4>
                    <p className="text-sm text-muted-foreground">
                      Get instant answers 24/7
                    </p>
                  </div>
                </button>

                <button
                  onClick={startHumanChat}
                  className="w-full p-4 rounded-xl border-2 border-emerald-500/20 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                    <User className="h-6 w-6 text-emerald-600 group-hover:text-white" />
                  </div>
                  <div className="text-left">
                    <h4 className="font-semibold">Talk to a Person</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect with our support team
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* User Form */}
          {showUserForm && (
            <div className="p-6 flex flex-col h-[calc(100%-72px)]">
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold mb-2">Before we connect you</h3>
                <p className="text-sm text-muted-foreground">
                  Please tell us a bit about yourself
                </p>
              </div>

              <form onSubmit={handleUserFormSubmit} className="space-y-4 flex-1">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name *</label>
                  <Input
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email (optional)</label>
                  <Input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
                <Button type="submit" className="w-full">
                  Connect with Support
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowUserForm(false)}
                >
                  Back
                </Button>
              </form>
            </div>
          )}

          {/* Chat Messages */}
          {(chatMode === "ai" || chatMode === "human") && !showUserForm && (
            <>
              <ScrollArea className="h-[calc(100%-136px)] p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex gap-2",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}
                    >
                      {message.role !== "user" && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback
                            className={cn(
                              message.role === "admin"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {message.role === "admin" ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                          message.role === "user"
                            ? "bg-primary text-white rounded-br-md"
                            : message.role === "admin"
                            ? "bg-emerald-100 text-emerald-900 rounded-bl-md"
                            : "bg-secondary text-foreground rounded-bl-md"
                        )}
                      >
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="chat-markdown">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        )}
                        <p
                          className={cn(
                            "text-[10px] mt-1",
                            message.role === "user"
                              ? "text-white/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex gap-2 justify-start">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" />
                          <span
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          />
                          <span
                            className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Admin typing indicator */}
                  {isAdminTyping && (
                    <div className="flex gap-2 justify-start">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">
                          <User className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-emerald-100 rounded-2xl rounded-bl-md px-4 py-3">
                        <p className="text-xs text-emerald-700">Typing...</p>
                      </div>
                    </div>
                  )}

                  {/* Waiting indicator */}
                  {isWaiting && chatMode === "human" && (
                    <div className="text-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Waiting for an available agent...
                      </p>
                      <button
                        onClick={switchToAI}
                        className="text-xs text-primary hover:underline mt-2"
                      >
                        Chat with AI instead
                      </button>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat mode badge */}
              {chatMode === "human" && !isWaiting && (
                <div className="px-4 pb-2">
                  <button
                    onClick={switchToAI}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    Switch to AI Assistant
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      isWaiting
                        ? "Waiting for agent..."
                        : "Type your message..."
                    }
                    disabled={isLoading || isWaiting}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!inputValue.trim() || isLoading || isWaiting}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
